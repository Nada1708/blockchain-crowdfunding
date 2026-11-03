import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export class NonceCapacityError extends Error {
  constructor() {
    super('The server has reached its active sign-in attempt limit.')
    this.name = 'NonceCapacityError'
  }
}

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest()
}

export class MemoryNonceStore {
  #records = new Map()
  #now

  constructor({ ttlMs = 5 * 60_000, maxActive = 1_000, now = () => Date.now() } = {}) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw new TypeError('ttlMs must be a positive integer.')
    if (!Number.isSafeInteger(maxActive) || maxActive <= 0) throw new TypeError('maxActive must be a positive integer.')
    this.ttlMs = ttlMs
    this.maxActive = maxActive
    this.#now = now
  }

  issue() {
    const now = this.#now()
    this.cleanupExpired(now)
    if (this.#records.size >= this.maxActive) throw new NonceCapacityError()

    const nonce = randomBytes(16).toString('hex')
    const attemptId = randomBytes(24).toString('base64url')
    const expiresAt = now + this.ttlMs

    this.#records.set(attemptId, {
      nonceHash: digest(nonce),
      expiresAt,
    })

    return { attemptId, nonce, expiresAt }
  }

  consume(attemptId, nonce) {
    if (!this.matches(attemptId, nonce)) return false

    // Map deletion is synchronous: only the first caller can observe and remove
    // this record, even when multiple Promise callbacks race in one Node process.
    return this.#records.delete(attemptId)
  }

  matches(attemptId, nonce) {
    if (typeof attemptId !== 'string' || typeof nonce !== 'string') return false
    const record = this.#records.get(attemptId)
    if (!record) return false

    const now = this.#now()
    if (record.expiresAt <= now) {
      this.#records.delete(attemptId)
      return false
    }

    const suppliedHash = digest(nonce)
    if (suppliedHash.length !== record.nonceHash.length || !timingSafeEqual(suppliedHash, record.nonceHash)) {
      return false
    }
    return true
  }

  cleanupExpired(now = this.#now()) {
    for (const [attemptId, record] of this.#records) {
      if (record.expiresAt <= now) this.#records.delete(attemptId)
    }
  }

  get activeCount() {
    this.cleanupExpired()
    return this.#records.size
  }
}
