import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { Wallet } from 'ethers'
import { SiweMessage } from 'siwe'
import { createApp } from '../app.mjs'
import { MemorySessionStore } from '../session-store.mjs'

const ORIGIN = 'http://localhost:5173'

function testConfig({ session = {}, siwe = {}, origins = [ORIGIN] } = {}) {
  return {
    trustProxy: false,
    allowedOrigins: new Set(origins),
    pinataJwt: null,
    session: {
      cookieName: 'fundora_session_dev',
      csrfCookieName: 'fundora_csrf_dev',
      secureCookies: false,
      sameSite: 'strict',
      idleTtlSeconds: 900,
      absoluteTtlSeconds: 3600,
      maxActive: 1_000,
      rateLimit: 120,
      rateLimitWindowMs: 900_000,
      ...session,
    },
    siwe: {
      domains: new Set(['localhost:5173']),
      uris: new Set([ORIGIN]),
      chainId: 31337,
      nonceCookieName: 'fundora_siwe_attempt',
      nonceTtlMs: 300_000,
      maxActiveNonces: 1_000,
      nonceRateLimit: 100,
      nonceRateLimitWindowMs: 300_000,
      verifyRateLimit: 100,
      verifyRateLimitWindowMs: 300_000,
      messageMaxAgeMs: 300_000,
      clockSkewMs: 60_000,
      ...siwe,
    },
  }
}

async function startApi(config = testConfig(), dependencies = {}) {
  const { app, sessionStore } = createApp(config, dependencies)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    sessionStore,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  }
}

function setCookieLines(response) {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie()
  return [response.headers.get('set-cookie') ?? '']
}

function responseCookie(response, name) {
  const line = setCookieLines(response).find((value) => value.startsWith(`${name}=`))
  assert.ok(line, `${name} cookie must be present`)
  return { pair: line.split(';', 1)[0], line }
}

function cookieValue(pair) {
  return pair.slice(pair.indexOf('=') + 1)
}

async function issueNonce(baseUrl, origin = ORIGIN) {
  const response = await fetch(`${baseUrl}/api/auth/nonce`, { headers: { Origin: origin } })
  assert.equal(response.status, 200)
  return {
    nonce: (await response.json()).nonce,
    cookie: responseCookie(response, 'fundora_siwe_attempt').pair,
  }
}

function makeMessage(wallet, nonce, origin = ORIGIN) {
  const url = new URL(origin)
  const now = Date.now()
  return new SiweMessage({
    domain: url.host,
    address: wallet.address,
    statement: 'Sign in to Fundora.',
    uri: origin,
    version: '1',
    chainId: 31337,
    nonce,
    issuedAt: new Date(now).toISOString(),
    expirationTime: new Date(now + 240_000).toISOString(),
  }).prepareMessage()
}

async function login(baseUrl, wallet, { origin = ORIGIN, previousCookies = '' } = {}) {
  const attempt = await issueNonce(baseUrl, origin)
  const message = makeMessage(wallet, attempt.nonce, origin)
  const signature = await wallet.signMessage(message)
  const cookies = [previousCookies, attempt.cookie].filter(Boolean).join('; ')
  const response = await fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { Origin: origin, Cookie: cookies, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, signature }),
  })
  assert.equal(response.status, 200)
  const sessionName = origin.startsWith('https:') ? '__Host-fundora_session' : 'fundora_session_dev'
  const csrfName = origin.startsWith('https:') ? '__Host-fundora_csrf' : 'fundora_csrf_dev'
  return {
    response,
    session: responseCookie(response, sessionName),
    csrf: responseCookie(response, csrfName),
  }
}

function sessionRequest(baseUrl, cookies, origin = ORIGIN) {
  return fetch(`${baseUrl}/api/auth/session`, { headers: { Origin: origin, Cookie: cookies } })
}

test('creates and retrieves a minimal authenticated session', async () => {
  const api = await startApi()
  try {
    const wallet = Wallet.createRandom()
    const auth = await login(api.baseUrl, wallet)
    assert.match(auth.session.line, /HttpOnly/i)
    assert.match(auth.session.line, /SameSite=Strict/i)
    assert.match(auth.session.line, /Path=\//i)
    assert.doesNotMatch(auth.session.line, /;\s*Secure/i)
    assert.doesNotMatch(auth.csrf.line, /HttpOnly/i)

    const response = await sessionRequest(api.baseUrl, `${auth.session.pair}; ${auth.csrf.pair}`)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.deepEqual(Object.keys(body).sort(), [
      'absoluteExpiresAt', 'address', 'authenticated', 'chainId', 'idleExpiresAt',
    ])
    assert.equal(body.authenticated, true)
    assert.equal(body.address, wallet.address)
    assert.equal(body.chainId, 31337)
    assert.ok(Date.parse(body.idleExpiresAt))
    assert.ok(Date.parse(body.absoluteExpiresAt))
  } finally { await api.close() }
})

test('returns unauthenticated and clears cookies when no session exists', async () => {
  const api = await startApi()
  try {
    const response = await sessionRequest(api.baseUrl, '')
    assert.deepEqual(await response.json(), { authenticated: false })
    assert.match(response.headers.get('set-cookie') ?? '', /fundora_session_dev=;/)
  } finally { await api.close() }
})

test('enforces idle expiry and renews activity without exceeding absolute expiry', async () => {
  let now = Date.now()
  const store = new MemorySessionStore({ idleTtlMs: 900_000, absoluteTtlMs: 3_600_000, now: () => now })
  const api = await startApi(testConfig(), { sessionStore: store })
  try {
    const wallet = Wallet.createRandom()
    const auth = await login(api.baseUrl, wallet)
    const cookies = `${auth.session.pair}; ${auth.csrf.pair}`
    const initial = await (await sessionRequest(api.baseUrl, cookies)).json()
    now += 300_000
    const renewed = await (await sessionRequest(api.baseUrl, cookies)).json()
    assert.ok(Date.parse(renewed.idleExpiresAt) > Date.parse(initial.idleExpiresAt))

    now += 900_001
    assert.deepEqual(await (await sessionRequest(api.baseUrl, cookies)).json(), { authenticated: false })
  } finally { await api.close() }

  const absoluteStart = Date.now()
  now = absoluteStart
  const absoluteStore = new MemorySessionStore({ idleTtlMs: 900_000, absoluteTtlMs: 3_600_000, now: () => now })
  const absoluteApi = await startApi(testConfig(), { sessionStore: absoluteStore })
  try {
    const auth = await login(absoluteApi.baseUrl, Wallet.createRandom())
    const cookies = `${auth.session.pair}; ${auth.csrf.pair}`
    for (const elapsed of [800_000, 1_600_000, 2_400_000, 3_200_000]) {
      now = absoluteStart + elapsed
      assert.equal((await (await sessionRequest(absoluteApi.baseUrl, cookies)).json()).authenticated, true)
    }
    now = absoluteStart + 3_600_000
    assert.deepEqual(await (await sessionRequest(absoluteApi.baseUrl, cookies)).json(), { authenticated: false })
  } finally { await absoluteApi.close() }
})

test('rotates sessions and invalidates a presented previous session', async () => {
  const api = await startApi()
  try {
    const wallet = Wallet.createRandom()
    const first = await login(api.baseUrl, wallet)
    const firstCookies = `${first.session.pair}; ${first.csrf.pair}`
    const second = await login(api.baseUrl, wallet, { previousCookies: firstCookies })
    assert.notEqual(second.session.pair, first.session.pair)
    assert.equal((await (await sessionRequest(api.baseUrl, firstCookies)).json()).authenticated, false)
    assert.equal((await (await sessionRequest(api.baseUrl, `${second.session.pair}; ${second.csrf.pair}`)).json()).authenticated, true)
  } finally { await api.close() }
})

test('does not accept a caller-supplied fixation identifier', async () => {
  const api = await startApi()
  try {
    const fixed = `fundora_session_dev=${'a'.repeat(43)}`
    const auth = await login(api.baseUrl, Wallet.createRandom(), { previousCookies: fixed })
    assert.notEqual(auth.session.pair, fixed)
    assert.equal((await (await sessionRequest(api.baseUrl, fixed)).json()).authenticated, false)
  } finally { await api.close() }
})

test('requires synchronized CSRF proof for logout and invalidates the session', async () => {
  const api = await startApi()
  try {
    const auth = await login(api.baseUrl, Wallet.createRandom())
    const cookies = `${auth.session.pair}; ${auth.csrf.pair}`
    const invalid = await fetch(`${api.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Origin: ORIGIN, Cookie: cookies, 'X-CSRF-Token': 'invalid' },
    })
    assert.equal(invalid.status, 403)
    assert.equal((await (await sessionRequest(api.baseUrl, cookies)).json()).authenticated, true)

    const logout = await fetch(`${api.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Cookie: cookies,
        'X-CSRF-Token': cookieValue(auth.csrf.pair),
      },
    })
    assert.equal(logout.status, 200)
    assert.deepEqual(await logout.json(), { authenticated: false })
    assert.match(logout.headers.get('set-cookie') ?? '', /fundora_session_dev=;/)
    assert.equal((await (await sessionRequest(api.baseUrl, cookies)).json()).authenticated, false)

    const absent = await fetch(`${api.baseUrl}/api/auth/logout`, {
      method: 'POST', headers: { Origin: ORIGIN },
    })
    assert.equal(absent.status, 200)
    assert.deepEqual(await absent.json(), { authenticated: false })
  } finally { await api.close() }
})

test('rejects logout from a forbidden origin', async () => {
  const api = await startApi()
  try {
    const auth = await login(api.baseUrl, Wallet.createRandom())
    const response = await fetch(`${api.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        Origin: 'https://attacker.example',
        Cookie: `${auth.session.pair}; ${auth.csrf.pair}`,
        'X-CSRF-Token': cookieValue(auth.csrf.pair),
      },
    })
    assert.equal(response.status, 403)
  } finally { await api.close() }
})

test('rejects logout request bodies and enforces the size limit', async () => {
  const api = await startApi()
  try {
    const auth = await login(api.baseUrl, Wallet.createRandom())
    const headers = {
      Origin: ORIGIN,
      Cookie: `${auth.session.pair}; ${auth.csrf.pair}`,
      'X-CSRF-Token': cookieValue(auth.csrf.pair),
      'Content-Type': 'text/plain',
    }
    assert.equal((await fetch(`${api.baseUrl}/api/auth/logout`, {
      method: 'POST', headers, body: 'unexpected',
    })).status, 400)
    assert.equal((await fetch(`${api.baseUrl}/api/auth/logout`, {
      method: 'POST', headers, body: 'x'.repeat(2_048),
    })).status, 413)
  } finally { await api.close() }
})

test('isolates authenticated sessions between browsers', async () => {
  const api = await startApi()
  try {
    const firstWallet = Wallet.createRandom()
    const secondWallet = Wallet.createRandom()
    const first = await login(api.baseUrl, firstWallet)
    const second = await login(api.baseUrl, secondWallet)
    const firstBody = await (await sessionRequest(api.baseUrl, `${first.session.pair}; ${first.csrf.pair}`)).json()
    const secondBody = await (await sessionRequest(api.baseUrl, `${second.session.pair}; ${second.csrf.pair}`)).json()
    assert.equal(firstBody.address, firstWallet.address)
    assert.equal(secondBody.address, secondWallet.address)
    assert.notEqual(first.session.pair, second.session.pair)
  } finally { await api.close() }
})

test('uses __Host and Secure session cookies for production HTTPS', async () => {
  const productionOrigin = 'https://fundora.example'
  const config = testConfig({
    origins: [productionOrigin],
    session: {
      cookieName: '__Host-fundora_session',
      csrfCookieName: '__Host-fundora_csrf',
      secureCookies: true,
    },
    siwe: {
      domains: new Set(['fundora.example']),
      uris: new Set([productionOrigin]),
    },
  })
  const api = await startApi(config)
  try {
    const auth = await login(api.baseUrl, Wallet.createRandom(), { origin: productionOrigin })
    assert.match(auth.session.line, /^__Host-fundora_session=/)
    assert.match(auth.session.line, /HttpOnly/i)
    assert.match(auth.session.line, /Secure/i)
    assert.match(auth.session.line, /SameSite=Strict/i)
    assert.match(auth.session.line, /Path=\//i)
    assert.doesNotMatch(auth.session.line, /Domain=/i)
  } finally { await api.close() }
})

test('rate limits session inspection attempts', async () => {
  const api = await startApi(testConfig({ session: { rateLimit: 2 } }))
  try {
    assert.equal((await sessionRequest(api.baseUrl, '')).status, 200)
    assert.equal((await sessionRequest(api.baseUrl, '')).status, 200)
    assert.equal((await sessionRequest(api.baseUrl, '')).status, 429)
  } finally { await api.close() }
})
