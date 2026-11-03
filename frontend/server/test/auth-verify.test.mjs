import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { Wallet } from 'ethers'
import { SiweMessage } from 'siwe'
import { createApp } from '../app.mjs'
import { MemoryNonceStore } from '../nonce-store.mjs'

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
      domains: new Set(['localhost:5173', '127.0.0.1:5173']),
      uris: new Set([ORIGIN, 'http://127.0.0.1:5173']),
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

async function issueNonce(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/nonce`, { headers: { Origin: ORIGIN } })
  assert.equal(response.status, 200)
  const cookie = (response.headers.get('set-cookie') ?? '').split(';', 1)[0]
  assert.match(cookie, /^fundora_siwe_attempt=[A-Za-z0-9_-]{32}$/)
  return { nonce: (await response.json()).nonce, cookie }
}

function makeMessage(wallet, nonce, overrides = {}) {
  const now = Date.now()
  return new SiweMessage({
    domain: 'localhost:5173',
    address: wallet.address,
    statement: 'Sign in to Fundora.',
    uri: ORIGIN,
    version: '1',
    chainId: 31337,
    nonce,
    issuedAt: new Date(now).toISOString(),
    expirationTime: new Date(now + 240_000).toISOString(),
    ...overrides,
  }).prepareMessage()
}

async function verify(baseUrl, cookie, message, signature, origin = ORIGIN) {
  return fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: {
      Origin: origin,
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, signature }),
  })
}

test('verifies a valid SIWE signature and returns only public identity data', async () => {
  const api = await startApi()
  try {
    const wallet = Wallet.createRandom()
    const attempt = await issueNonce(api.baseUrl)
    const message = makeMessage(wallet, attempt.nonce)
    const response = await verify(api.baseUrl, attempt.cookie, message, await wallet.signMessage(message))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'verified', address: wallet.address, chainId: 31337 })
    assert.match(response.headers.get('set-cookie') ?? '', /fundora_siwe_attempt=;/)
  } finally { await api.close() }
})

test('rejects an invalid signature without consuming the nonce', async () => {
  const api = await startApi()
  try {
    const wallet = Wallet.createRandom()
    const attacker = Wallet.createRandom()
    const attempt = await issueNonce(api.baseUrl)
    const message = makeMessage(wallet, attempt.nonce)
    assert.equal((await verify(api.baseUrl, attempt.cookie, message, await attacker.signMessage(message))).status, 401)
    assert.equal((await verify(api.baseUrl, attempt.cookie, message, await wallet.signMessage(message))).status, 200)
  } finally { await api.close() }
})

test('rejects a message signed by an account different from its declared address', async () => {
  const api = await startApi()
  try {
    const declared = Wallet.createRandom()
    const signer = Wallet.createRandom()
    const attempt = await issueNonce(api.baseUrl)
    const message = makeMessage(declared, attempt.nonce)
    assert.equal((await verify(api.baseUrl, attempt.cookie, message, await signer.signMessage(message))).status, 401)
  } finally { await api.close() }
})

test('rejects a message altered after signing without consuming the nonce', async () => {
  const api = await startApi()
  try {
    const wallet = Wallet.createRandom()
    const attempt = await issueNonce(api.baseUrl)
    const message = makeMessage(wallet, attempt.nonce)
    const signature = await wallet.signMessage(message)
    const altered = message.replace('Sign in to Fundora.', 'Sign in to another application.')
    assert.equal((await verify(api.baseUrl, attempt.cookie, altered, signature)).status, 401)
    assert.equal((await verify(api.baseUrl, attempt.cookie, message, signature)).status, 200)
  } finally { await api.close() }
})

test('rejects unknown and cross-browser nonces without consuming valid attempts', async () => {
  const api = await startApi()
  try {
    const wallet = Wallet.createRandom()
    const first = await issueNonce(api.baseUrl)
    const second = await issueNonce(api.baseUrl)
    const unknownMessage = makeMessage(wallet, 'a'.repeat(32))
    assert.equal((await verify(api.baseUrl, first.cookie, unknownMessage, await wallet.signMessage(unknownMessage))).status, 401)

    const secondMessage = makeMessage(wallet, second.nonce)
    const secondSignature = await wallet.signMessage(secondMessage)
    assert.equal((await verify(api.baseUrl, first.cookie, secondMessage, secondSignature)).status, 401)
    assert.equal((await verify(api.baseUrl, second.cookie, secondMessage, secondSignature)).status, 200)
  } finally { await api.close() }
})

test('rejects an expired nonce record', async () => {
  let storeNow = Date.now()
  const store = new MemoryNonceStore({ ttlMs: 300_000, now: () => storeNow })
  const api = await startApi(testConfig(), { nonceStore: store })
  try {
    const wallet = Wallet.createRandom()
    const attempt = await issueNonce(api.baseUrl)
    const message = makeMessage(wallet, attempt.nonce)
    storeNow += 300_001
    assert.equal((await verify(api.baseUrl, attempt.cookie, message, await wallet.signMessage(message))).status, 401)
  } finally { await api.close() }
})

test('rejects replay and permits only one concurrent verification', async () => {
  const api = await startApi()
  try {
    const wallet = Wallet.createRandom()
    const attempt = await issueNonce(api.baseUrl)
    const message = makeMessage(wallet, attempt.nonce)
    const signature = await wallet.signMessage(message)
    const responses = await Promise.all(
      Array.from({ length: 8 }, () => verify(api.baseUrl, attempt.cookie, message, signature)),
    )
    assert.equal(responses.filter((response) => response.status === 200).length, 1)
    assert.equal(responses.filter((response) => response.status === 401).length, 7)
    assert.equal((await verify(api.baseUrl, attempt.cookie, message, signature)).status, 401)
  } finally { await api.close() }
})

test('rejects unauthorized domain, URI, chain ID, and version', async () => {
  const cases = [
    { domain: 'evil.example', uri: 'https://evil.example' },
    { uri: `${ORIGIN}/unexpected` },
    { chainId: 1 },
  ]

  for (const fields of cases) {
    const api = await startApi()
    try {
      const wallet = Wallet.createRandom()
      const attempt = await issueNonce(api.baseUrl)
      const message = makeMessage(wallet, attempt.nonce, fields)
      assert.equal((await verify(api.baseUrl, attempt.cookie, message, await wallet.signMessage(message))).status, 401)
    } finally { await api.close() }
  }

  const api = await startApi()
  try {
    const wallet = Wallet.createRandom()
    const attempt = await issueNonce(api.baseUrl)
    const valid = makeMessage(wallet, attempt.nonce)
    const wrongVersion = valid.replace('Version: 1', 'Version: 2')
    assert.notEqual((await verify(api.baseUrl, attempt.cookie, wrongVersion, await wallet.signMessage(wrongVersion))).status, 200)
  } finally { await api.close() }
})

test('rejects expired, future, not-before, and malformed dates', async () => {
  const now = Date.now()
  const dateCases = [
    { issuedAt: new Date(now - 360_000).toISOString(), expirationTime: new Date(now - 60_000).toISOString() },
    { issuedAt: new Date(now + 120_000).toISOString(), expirationTime: new Date(now + 240_000).toISOString() },
    { notBefore: new Date(now + 120_000).toISOString() },
  ]

  for (const fields of dateCases) {
    const api = await startApi()
    try {
      const wallet = Wallet.createRandom()
      const attempt = await issueNonce(api.baseUrl)
      const message = makeMessage(wallet, attempt.nonce, fields)
      assert.equal((await verify(api.baseUrl, attempt.cookie, message, await wallet.signMessage(message))).status, 401)
    } finally { await api.close() }
  }

  const api = await startApi()
  try {
    const wallet = Wallet.createRandom()
    const attempt = await issueNonce(api.baseUrl)
    const valid = makeMessage(wallet, attempt.nonce)
    const malformed = valid.replace(/Issued At: .+/, 'Issued At: not-a-date')
    assert.equal((await verify(api.baseUrl, attempt.cookie, malformed, await wallet.signMessage(malformed))).status, 400)
  } finally { await api.close() }
})

test('rejects malformed requests, oversized bodies, and forbidden origins', async () => {
  const api = await startApi()
  try {
    const invalidType = await fetch(`${api.baseUrl}/api/auth/verify`, {
      method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'text/plain' }, body: '{}',
    })
    assert.equal(invalidType.status, 415)

    const malformed = await fetch(`${api.baseUrl}/api/auth/verify`, {
      method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{',
    })
    assert.equal(malformed.status, 400)

    const oversized = await fetch(`${api.baseUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'x'.repeat(13_000), signature: `0x${'0'.repeat(130)}` }),
    })
    assert.equal(oversized.status, 413)

    const forbidden = await fetch(`${api.baseUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'x', signature: `0x${'0'.repeat(130)}` }),
    })
    assert.equal(forbidden.status, 403)
  } finally { await api.close() }
})

test('rate limits verification independently', async () => {
  const api = await startApi(testConfig({ verifyRateLimit: 2 }))
  try {
    const request = () => fetch(`${api.baseUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'x', signature: `0x${'0'.repeat(130)}` }),
    })
    assert.equal((await request()).status, 401)
    assert.equal((await request()).status, 401)
    assert.equal((await request()).status, 429)
  } finally { await api.close() }
})
