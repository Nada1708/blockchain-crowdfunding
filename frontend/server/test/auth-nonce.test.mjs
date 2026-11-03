import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp } from '../app.mjs'
import { MemoryNonceStore, NonceCapacityError } from '../nonce-store.mjs'

const ORIGIN = 'http://localhost:5173'

function testConfig(overrides = {}) {
  return {
    trustProxy: false,
    allowedOrigins: new Set([ORIGIN, 'http://127.0.0.1:5173']),
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
    },
    siwe: {
      nonceCookieName: 'fundora_siwe_attempt',
      nonceTtlMs: 300_000,
      maxActiveNonces: 1_000,
      nonceRateLimit: 100,
      nonceRateLimitWindowMs: 300_000,
      verifyRateLimit: 100,
      verifyRateLimitWindowMs: 300_000,
      messageMaxAgeMs: 300_000,
      clockSkewMs: 60_000,
      domains: new Set(['localhost:5173', '127.0.0.1:5173']),
      uris: new Set([ORIGIN, 'http://127.0.0.1:5173']),
      chainId: 31337,
      ...overrides,
    },
  }
}

async function startApi(config = testConfig(), dependencies = {}) {
  const { app, nonceStore } = createApp(config, dependencies)
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    nonceStore,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  }
}

function attemptIdFrom(response) {
  const cookie = response.headers.get('set-cookie') ?? ''
  const match = cookie.match(/fundora_siwe_attempt=([A-Za-z0-9_-]{32})/)
  assert.ok(match, 'the opaque attempt cookie must be present')
  return match[1]
}

async function requestNonce(baseUrl, headers = { Origin: ORIGIN }) {
  return fetch(`${baseUrl}/api/auth/nonce`, { headers })
}

test('issues unique ERC-4361-compatible nonces and a protected local cookie', async () => {
  const api = await startApi()
  try {
    const nonces = new Set()
    for (let index = 0; index < 24; index += 1) {
      const response = await requestNonce(api.baseUrl)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const { nonce } = await response.json()
      assert.match(nonce, /^[A-Za-z0-9]{32}$/)
      nonces.add(nonce)

      const cookie = response.headers.get('set-cookie') ?? ''
      assert.match(cookie, /HttpOnly/i)
      assert.match(cookie, /SameSite=Strict/i)
      assert.match(cookie, /Path=\/api\/auth/i)
      assert.doesNotMatch(cookie, /;\s*Secure/i)
    }
    assert.equal(nonces.size, 24)
  } finally {
    await api.close()
  }
})

test('accepts only an allowed Origin or explicit same-origin browser signals', async () => {
  const api = await startApi()
  try {
    assert.equal((await requestNonce(api.baseUrl, {})).status, 403)
    assert.equal((await requestNonce(api.baseUrl, { Origin: 'https://attacker.example' })).status, 403)
    assert.equal((await requestNonce(api.baseUrl, {
      Referer: `${ORIGIN}/welcome`,
      'Sec-Fetch-Site': 'same-origin',
    })).status, 200)
  } finally {
    await api.close()
  }
})

test('isolates nonces between anonymous browser attempts', async () => {
  const api = await startApi()
  try {
    const firstResponse = await requestNonce(api.baseUrl)
    const firstId = attemptIdFrom(firstResponse)
    const firstNonce = (await firstResponse.json()).nonce
    const secondResponse = await requestNonce(api.baseUrl)
    const secondId = attemptIdFrom(secondResponse)
    const secondNonce = (await secondResponse.json()).nonce

    assert.notEqual(firstId, secondId)
    assert.equal(api.nonceStore.consume(firstId, secondNonce), false)
    assert.equal(api.nonceStore.consume(secondId, firstNonce), false)
    assert.equal(api.nonceStore.consume(firstId, firstNonce), true)
    assert.equal(api.nonceStore.consume(secondId, secondNonce), true)
  } finally {
    await api.close()
  }
})

test('expires nonce records after their configured lifetime', () => {
  let now = 10_000
  const store = new MemoryNonceStore({ ttlMs: 300_000, now: () => now })
  const issued = store.issue()
  now = issued.expiresAt
  assert.equal(store.consume(issued.attemptId, issued.nonce), false)
  assert.equal(store.activeCount, 0)
})

test('consumes a nonce once and rejects replay', () => {
  const store = new MemoryNonceStore()
  const issued = store.issue()
  assert.equal(store.consume(issued.attemptId, issued.nonce), true)
  assert.equal(store.consume(issued.attemptId, issued.nonce), false)
})

test('allows only one winner during concurrent consumption', async () => {
  const store = new MemoryNonceStore()
  const issued = store.issue()
  const results = await Promise.all(
    Array.from({ length: 20 }, async () => store.consume(issued.attemptId, issued.nonce)),
  )
  assert.equal(results.filter(Boolean).length, 1)
})

test('bounds the number of active anonymous attempts', () => {
  const store = new MemoryNonceStore({ maxActive: 2 })
  store.issue()
  store.issue()
  assert.throws(() => store.issue(), NonceCapacityError)
})

test('rate limits nonce issuance independently', async () => {
  const api = await startApi(testConfig({ nonceRateLimit: 2 }))
  try {
    assert.equal((await requestNonce(api.baseUrl)).status, 200)
    assert.equal((await requestNonce(api.baseUrl)).status, 200)
    const limited = await requestNonce(api.baseUrl)
    assert.equal(limited.status, 429)
  } finally {
    await api.close()
  }
})
