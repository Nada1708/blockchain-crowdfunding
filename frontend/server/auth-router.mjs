import { Router, json, raw } from 'express'
import { rateLimit } from 'express-rate-limit'
import { getAddress } from 'ethers'
import { SiweMessage } from 'siwe'
import { MemoryNonceStore, NonceCapacityError } from './nonce-store.mjs'
import { MemorySessionStore, SessionCapacityError } from './session-store.mjs'

const ATTEMPT_ID = /^[A-Za-z0-9_-]{32}$/
const SESSION_TOKEN = /^[A-Za-z0-9_-]{43}$/

function cookieValue(request, name, pattern) {
  const header = request.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue
    const value = part.slice(separator + 1).trim()
    return pattern.test(value) ? value : null
  }
  return null
}

function sessionCookieOptions(config, maxAge) {
  return {
    httpOnly: true,
    secure: config.session.secureCookies,
    sameSite: config.session.sameSite,
    path: '/',
    maxAge,
  }
}

function csrfCookieOptions(config, maxAge) {
  return {
    httpOnly: false,
    secure: config.session.secureCookies,
    sameSite: config.session.sameSite,
    path: '/',
    maxAge,
  }
}

function clearSessionCookies(response, config) {
  const common = { secure: config.session.secureCookies, sameSite: config.session.sameSite, path: '/' }
  response.clearCookie(config.session.cookieName, { ...common, httpOnly: true })
  response.clearCookie(config.session.csrfCookieName, { ...common, httpOnly: false })
}

function publicSession(session) {
  return {
    authenticated: true,
    address: session.address,
    chainId: session.chainId,
    idleExpiresAt: new Date(session.idleExpiresAt).toISOString(),
    absoluteExpiresAt: new Date(session.absoluteExpiresAt).toISOString(),
  }
}

function originFromReferer(value) {
  if (!value) return null
  try { return new URL(value).origin } catch { return null }
}

function requireTrustedBrowserOrigin(allowedOrigins) {
  return function trustedBrowserOrigin(request, response, next) {
    const origin = request.get('origin')
    if (origin) {
      if (allowedOrigins.has(origin)) {
        response.locals.requestOrigin = origin
        return next()
      }
      response.status(403).json({ error: 'This origin is not allowed.' })
      return
    }

    const sameOrigin = request.get('sec-fetch-site') === 'same-origin'
    const refererOrigin = originFromReferer(request.get('referer'))
    if (sameOrigin && refererOrigin && allowedOrigins.has(refererOrigin)) {
      response.locals.requestOrigin = refererOrigin
      return next()
    }

    response.status(403).json({ error: 'A trusted browser origin is required.' })
  }
}

function validRequestBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false
  const keys = Object.keys(body).sort()
  return keys.length === 2 && keys[0] === 'message' && keys[1] === 'signature'
    && typeof body.message === 'string' && body.message.length > 0 && body.message.length <= 4_096
    && typeof body.signature === 'string' && /^0x(?:[0-9a-fA-F]{128}|[0-9a-fA-F]{130})$/.test(body.signature)
}

function dateValue(value) {
  if (typeof value !== 'string') return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hasValidMessageScope(message, config, requestOrigin, now) {
  if (message.version !== '1' || message.chainId !== config.siwe.chainId) return false
  if (!config.siwe.domains.has(message.domain) || !config.siwe.uris.has(message.uri)) return false

  let uri
  try { uri = new URL(message.uri) } catch { return false }
  if (uri.origin !== requestOrigin || uri.host !== message.domain) return false
  if (message.scheme && `${message.scheme}:` !== uri.protocol) return false

  try {
    if (getAddress(message.address) !== message.address) return false
  } catch {
    return false
  }

  const issuedAt = dateValue(message.issuedAt)
  if (issuedAt === null) return false
  if (issuedAt > now + config.siwe.clockSkewMs) return false
  if (issuedAt < now - config.siwe.messageMaxAgeMs - config.siwe.clockSkewMs) return false

  if (message.expirationTime !== undefined) {
    const expiration = dateValue(message.expirationTime)
    if (expiration === null || expiration <= now || expiration <= issuedAt) return false
    if (expiration - issuedAt > config.siwe.messageMaxAgeMs + config.siwe.clockSkewMs) return false
  }

  if (message.notBefore !== undefined) {
    const notBefore = dateValue(message.notBefore)
    if (notBefore === null || notBefore > now + config.siwe.clockSkewMs) return false
    if (message.expirationTime && notBefore >= dateValue(message.expirationTime)) return false
  }

  return true
}

export function createAuthRouter(config, { nonceStore, sessionStore } = {}) {
  const router = Router()
  const store = nonceStore ?? new MemoryNonceStore({
    ttlMs: config.siwe.nonceTtlMs,
    maxActive: config.siwe.maxActiveNonces,
  })
  const sessions = sessionStore ?? new MemorySessionStore({
    idleTtlMs: config.session.idleTtlSeconds * 1_000,
    absoluteTtlMs: config.session.absoluteTtlSeconds * 1_000,
    maxActive: config.session.maxActive,
  })
  const nonceLimiter = rateLimit({
    windowMs: config.siwe.nonceRateLimitWindowMs,
    limit: config.siwe.nonceRateLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Please wait and try again.' },
  })
  const verifyLimiter = rateLimit({
    windowMs: config.siwe.verifyRateLimitWindowMs,
    limit: config.siwe.verifyRateLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many verification attempts. Please wait and try again.' },
  })
  const trustedOrigin = requireTrustedBrowserOrigin(config.allowedOrigins)
  const sessionLimiter = rateLimit({
    windowMs: config.session.rateLimitWindowMs,
    limit: config.session.rateLimit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many session requests. Please wait and try again.' },
  })

  router.get(
    '/nonce',
    trustedOrigin,
    nonceLimiter,
    (request, response, next) => {
      try {
        // Reading validates an incoming cookie shape without treating it as an
        // authority. Every issuance still receives a new opaque attempt ID.
        cookieValue(request, config.siwe.nonceCookieName, ATTEMPT_ID)
        const { attemptId, nonce } = store.issue()
        response.cookie(config.siwe.nonceCookieName, attemptId, {
          httpOnly: true,
          secure: config.session.secureCookies,
          sameSite: 'strict',
          path: '/api/auth',
          maxAge: config.siwe.nonceTtlMs,
        })
        response.set('Cache-Control', 'no-store')
        response.json({ nonce })
      } catch (error) {
        if (error instanceof NonceCapacityError) {
          response.status(503).json({ error: 'Sign-in is temporarily unavailable. Please try again.' })
          return
        }
        next(error)
      }
    },
  )

  router.post(
    '/verify',
    trustedOrigin,
    verifyLimiter,
    (request, response, next) => {
      if (!request.is('application/json')) {
        response.status(415).json({ error: 'The authentication request is invalid.' })
        return
      }
      next()
    },
    json({ limit: '12kb', strict: true, type: 'application/json' }),
    async (request, response) => {
      const verificationFailed = () => response.status(401).json({ error: 'Sign-in verification failed.' })
      if (!validRequestBody(request.body)) {
        response.status(400).json({ error: 'The authentication request is invalid.' })
        return
      }

      const attemptId = cookieValue(request, config.siwe.nonceCookieName, ATTEMPT_ID)
      if (!attemptId) return verificationFailed()

      let message
      try {
        message = new SiweMessage(request.body.message)
      } catch {
        response.status(400).json({ error: 'The authentication request is invalid.' })
        return
      }

      const now = Date.now()
      if (!hasValidMessageScope(message, config, response.locals.requestOrigin, now)) return verificationFailed()
      if (!store.matches(attemptId, message.nonce)) return verificationFailed()

      let verification
      try {
        verification = await message.verify(
          {
            signature: request.body.signature,
            domain: message.domain,
            nonce: message.nonce,
            time: new Date(now).toISOString(),
          },
          { suppressExceptions: true },
        )
      } catch {
        return verificationFailed()
      }

      if (!verification.success) return verificationFailed()
      if (!store.consume(attemptId, message.nonce)) return verificationFailed()

      const previousSessionId = cookieValue(request, config.session.cookieName, SESSION_TOKEN)
      let created
      try {
        created = sessions.create({
          address: message.address,
          chainId: message.chainId,
          previousSessionId,
        })
      } catch (error) {
        if (error instanceof SessionCapacityError) {
          response.status(503).json({ error: 'Sign-in is temporarily unavailable. Please try again.' })
          return
        }
        throw error
      }

      response.clearCookie(config.siwe.nonceCookieName, {
        httpOnly: true,
        secure: config.session.secureCookies,
        sameSite: 'strict',
        path: '/api/auth',
      })
      const sessionMaxAge = created.session.idleExpiresAt - created.session.lastSeenAt
      response.cookie(
        config.session.cookieName,
        created.sessionId,
        sessionCookieOptions(config, sessionMaxAge),
      )
      response.cookie(
        config.session.csrfCookieName,
        created.csrfToken,
        csrfCookieOptions(config, sessionMaxAge),
      )
      response.json({
        status: 'verified',
        address: message.address,
        chainId: message.chainId,
      })
    },
  )

  router.get('/session', trustedOrigin, sessionLimiter, (request, response) => {
    const sessionId = cookieValue(request, config.session.cookieName, SESSION_TOKEN)
    const session = sessionId ? sessions.get(sessionId) : null
    if (!session || !sessionId) {
      clearSessionCookies(response, config)
      response.json({ authenticated: false })
      return
    }

    let csrfToken = cookieValue(request, config.session.csrfCookieName, SESSION_TOKEN)
    const maxAge = session.idleExpiresAt - session.lastSeenAt
    response.cookie(config.session.cookieName, sessionId, sessionCookieOptions(config, maxAge))
    if (!csrfToken || !sessions.validateCsrf(sessionId, csrfToken)) csrfToken = sessions.rotateCsrf(sessionId)
    if (csrfToken) response.cookie(config.session.csrfCookieName, csrfToken, csrfCookieOptions(config, maxAge))
    response.json(publicSession(session))
  })

  router.post('/logout', trustedOrigin, sessionLimiter, raw({ limit: '1kb', type: () => true }), (request, response) => {
    if (request.body?.length > 0) {
      response.status(400).json({ error: 'The logout request must not contain a body.' })
      return
    }

    const sessionId = cookieValue(request, config.session.cookieName, SESSION_TOKEN)
    const session = sessionId ? sessions.get(sessionId, { touch: false }) : null
    if (!session || !sessionId) {
      clearSessionCookies(response, config)
      response.json({ authenticated: false })
      return
    }

    const csrfCookie = cookieValue(request, config.session.csrfCookieName, SESSION_TOKEN)
    const csrfHeader = request.get('x-csrf-token')
    if (!csrfCookie || csrfHeader !== csrfCookie || !sessions.validateCsrf(sessionId, csrfHeader)) {
      response.status(403).json({ error: 'The request could not be authorized.' })
      return
    }

    sessions.revoke(sessionId)
    clearSessionCookies(response, config)
    response.json({ authenticated: false })
  })

  return { router, nonceStore: store, sessionStore: sessions }
}
