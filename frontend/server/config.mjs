const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

function readList(name, fallback) {
  const raw = process.env[name]
  const values = (raw ? raw.split(',') : fallback)
    .map((value) => value.trim())
    .filter(Boolean)

  if (values.length === 0) throw new Error(`${name} must contain at least one value.`)
  return values
}

function readInteger(name, fallback, { min, max }) {
  const raw = process.env[name]
  const value = raw === undefined || raw === '' ? fallback : Number(raw)
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`)
  }
  return value
}

function readBoolean(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined || raw === '') return fallback
  if (raw === 'true') return true
  if (raw === 'false') return false
  throw new Error(`${name} must be either true or false.`)
}

function requireHttpOrigin(value, name) {
  let url
  try { url = new URL(value) } catch { throw new Error(`${name} contains an invalid URL.`) }
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password) {
    throw new Error(`${name} entries must be exact HTTP(S) origins without credentials or paths.`)
  }
  return url.origin
}

function requireDomain(value, allowedOrigins) {
  if (value.includes('://') || value.includes('/') || value.includes('@')) {
    throw new Error('SIWE_ALLOWED_DOMAINS entries must be host authorities only.')
  }
  if (!allowedOrigins.some((origin) => new URL(origin).host === value)) {
    throw new Error('Every SIWE domain must correspond to an allowed origin.')
  }
  return value
}

function requireSiweUri(value, allowedOrigins) {
  let url
  try { url = new URL(value) } catch { throw new Error('SIWE_ALLOWED_URIS contains an invalid URL.') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('SIWE URIs must use HTTP(S) and must not contain credentials.')
  }
  if (!allowedOrigins.includes(url.origin)) {
    throw new Error('Every SIWE URI must use an allowed origin.')
  }
  return url.href.replace(/\/$/, '')
}

export function loadConfig() {
  const nodeEnv = process.env.NODE_ENV ?? 'development'
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production.')
  }

  const configuredOrigins = process.env.FUNDORA_ALLOWED_ORIGINS ?? process.env.IPFS_PROXY_ALLOWED_ORIGINS
  const allowedOrigins = readList(
    'FUNDORA_ALLOWED_ORIGINS',
    configuredOrigins ? configuredOrigins.split(',') : DEFAULT_ORIGINS,
  ).map((origin) => requireHttpOrigin(origin, 'FUNDORA_ALLOWED_ORIGINS'))

  const defaultDomains = allowedOrigins.map((origin) => new URL(origin).host)
  const siweDomains = readList('SIWE_ALLOWED_DOMAINS', defaultDomains)
    .map((domain) => requireDomain(domain, allowedOrigins))
  const siweUris = readList('SIWE_ALLOWED_URIS', allowedOrigins)
    .map((uri) => requireSiweUri(uri, allowedOrigins))
  const siweChainId = readInteger('SIWE_CHAIN_ID', 31337, { min: 1, max: 4_294_967_295 })
  if (siweChainId !== 31337) {
    throw new Error('Fundora V3 currently accepts SIWE only on Hardhat Local (chain ID 31337).')
  }

  const sessionIdleTtlSeconds = readInteger('SESSION_IDLE_TTL_SECONDS', 900, { min: 300, max: 86_400 })
  const sessionAbsoluteTtlSeconds = readInteger('SESSION_ABSOLUTE_TTL_SECONDS', 3600, {
    min: sessionIdleTtlSeconds,
    max: 604_800,
  })
  const secureCookies = readBoolean('SESSION_COOKIE_SECURE', nodeEnv === 'production')
  const expectedSessionCookieName = nodeEnv === 'production' ? '__Host-fundora_session' : 'fundora_session_dev'
  const expectedCsrfCookieName = nodeEnv === 'production' ? '__Host-fundora_csrf' : 'fundora_csrf_dev'
  const cookieName = process.env.SESSION_COOKIE_NAME?.trim() || expectedSessionCookieName
  const csrfCookieName = process.env.CSRF_COOKIE_NAME?.trim() || expectedCsrfCookieName
  const sameSite = process.env.SESSION_COOKIE_SAME_SITE?.trim().toLowerCase() || 'strict'
  const nonceCookieName = process.env.SIWE_NONCE_COOKIE_NAME?.trim() || 'fundora_siwe_attempt'

  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(cookieName)) {
    throw new Error('SESSION_COOKIE_NAME must be a valid cookie token.')
  }
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(nonceCookieName)) {
    throw new Error('SIWE_NONCE_COOKIE_NAME must be a valid cookie token.')
  }
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(csrfCookieName)) {
    throw new Error('CSRF_COOKIE_NAME must be a valid cookie token.')
  }
  if (!['strict', 'lax'].includes(sameSite)) {
    throw new Error('SESSION_COOKIE_SAME_SITE must be strict or lax.')
  }
  if (nodeEnv === 'production' && cookieName !== '__Host-fundora_session') {
    throw new Error('Production must use the __Host-fundora_session cookie name.')
  }
  if (nodeEnv === 'production' && csrfCookieName !== '__Host-fundora_csrf') {
    throw new Error('Production must use the __Host-fundora_csrf cookie name.')
  }
  if (nodeEnv === 'production' && (!secureCookies || allowedOrigins.some((origin) => !origin.startsWith('https://')))) {
    throw new Error('Production requires secure session cookies and HTTPS-only allowed origins.')
  }

  return Object.freeze({
    nodeEnv,
    host: process.env.FUNDORA_API_HOST?.trim() || '127.0.0.1',
    port: readInteger(
      'FUNDORA_API_PORT',
      readInteger('IPFS_PROXY_PORT', 8787, { min: 1, max: 65_535 }),
      { min: 1, max: 65_535 },
    ),
    trustProxy: readBoolean('FUNDORA_TRUST_PROXY', false),
    allowedOrigins: new Set(allowedOrigins),
    siwe: Object.freeze({
      domains: new Set(siweDomains),
      uris: new Set(siweUris),
      chainId: siweChainId,
      nonceCookieName,
      nonceTtlMs: readInteger('SIWE_NONCE_TTL_SECONDS', 300, { min: 60, max: 600 }) * 1_000,
      maxActiveNonces: readInteger('SIWE_NONCE_MAX_ACTIVE', 1_000, { min: 10, max: 100_000 }),
      nonceRateLimit: readInteger('SIWE_NONCE_RATE_LIMIT', 10, { min: 1, max: 100 }),
      nonceRateLimitWindowMs: readInteger('SIWE_NONCE_RATE_WINDOW_SECONDS', 300, { min: 60, max: 3_600 }) * 1_000,
      verifyRateLimit: readInteger('SIWE_VERIFY_RATE_LIMIT', 10, { min: 1, max: 100 }),
      verifyRateLimitWindowMs: readInteger('SIWE_VERIFY_RATE_WINDOW_SECONDS', 300, { min: 60, max: 3_600 }) * 1_000,
      messageMaxAgeMs: readInteger('SIWE_MESSAGE_MAX_AGE_SECONDS', 300, { min: 60, max: 600 }) * 1_000,
      clockSkewMs: readInteger('SIWE_CLOCK_SKEW_SECONDS', 60, { min: 0, max: 300 }) * 1_000,
    }),
    session: Object.freeze({
      cookieName,
      csrfCookieName,
      sameSite,
      idleTtlSeconds: sessionIdleTtlSeconds,
      absoluteTtlSeconds: sessionAbsoluteTtlSeconds,
      secureCookies,
      maxActive: readInteger('SESSION_MAX_ACTIVE', 1_000, { min: 10, max: 100_000 }),
      rateLimit: readInteger('SESSION_RATE_LIMIT', 120, { min: 10, max: 1_000 }),
      rateLimitWindowMs: readInteger('SESSION_RATE_WINDOW_SECONDS', 900, { min: 60, max: 3_600 }) * 1_000,
    }),
    pinataJwt: process.env.PINATA_JWT || null,
  })
}
