import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export class SessionCapacityError extends Error {
  constructor() {
    super('The server has reached its active session limit.')
    this.name = 'SessionCapacityError'
  }
}

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest()
}

function digestKey(value) {
  return digest(value).toString('hex')
}

function safeHashMatch(value, expectedHash) {
  if (typeof value !== 'string') return false
  const supplied = digest(value)
  return supplied.length === expectedHash.length && timingSafeEqual(supplied, expectedHash)
}

export class MemorySessionStore {
  #records = new Map()
  #now

  constructor({
    idleTtlMs = 15 * 60_000,
    absoluteTtlMs = 60 * 60_000,
    maxActive = 1_000,
    now = () => Date.now(),
  } = {}) {
    if (!Number.isSafeInteger(idleTtlMs) || idleTtlMs <= 0) throw new TypeError('idleTtlMs must be positive.')
    if (!Number.isSafeInteger(absoluteTtlMs) || absoluteTtlMs < idleTtlMs) throw new TypeError('absoluteTtlMs must cover idleTtlMs.')
    if (!Number.isSafeInteger(maxActive) || maxActive <= 0) throw new TypeError('maxActive must be positive.')
    this.idleTtlMs = idleTtlMs
    this.absoluteTtlMs = absoluteTtlMs
    this.maxActive = maxActive
    this.#now = now
  }

  create({ address, chainId, previousSessionId = null }) {
    if (previousSessionId) this.revoke(previousSessionId)
    const now = this.#now()
    this.cleanupExpired(now)
    if (this.#records.size >= this.maxActive) throw new SessionCapacityError()

    const sessionId = randomBytes(32).toString('base64url')
    const csrfToken = randomBytes(32).toString('base64url')
    const absoluteExpiresAt = now + this.absoluteTtlMs
    const idleExpiresAt = Math.min(now + this.idleTtlMs, absoluteExpiresAt)

    this.#records.set(digestKey(sessionId), {
      address,
      chainId,
      csrfHash: digest(csrfToken),
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt,
      absoluteExpiresAt,
    })

    return { sessionId, csrfToken, session: this.#publicRecord(this.#records.get(digestKey(sessionId))) }
  }

  get(sessionId, { touch = true } = {}) {
    if (typeof sessionId !== 'string') return null
    const key = digestKey(sessionId)
    const record = this.#records.get(key)
    if (!record) return null

    const now = this.#now()
    if (record.idleExpiresAt <= now || record.absoluteExpiresAt <= now) {
      this.#records.delete(key)
      return null
    }

    if (touch) {
      record.lastSeenAt = now
      record.idleExpiresAt = Math.min(now + this.idleTtlMs, record.absoluteExpiresAt)
    }
    return this.#publicRecord(record)
  }

  validateCsrf(sessionId, csrfToken) {
    if (typeof sessionId !== 'string') return false
    const record = this.#records.get(digestKey(sessionId))
    if (!record) return false
    const now = this.#now()
    if (record.idleExpiresAt <= now || record.absoluteExpiresAt <= now) {
      this.#records.delete(digestKey(sessionId))
      return false
    }
    return safeHashMatch(csrfToken, record.csrfHash)
  }

  rotateCsrf(sessionId) {
    if (typeof sessionId !== 'string') return null
    const record = this.#records.get(digestKey(sessionId))
    if (!record) return null
    const now = this.#now()
    if (record.idleExpiresAt <= now || record.absoluteExpiresAt <= now) {
      this.#records.delete(digestKey(sessionId))
      return null
    }
    const csrfToken = randomBytes(32).toString('base64url')
    record.csrfHash = digest(csrfToken)
    return csrfToken
  }

  revoke(sessionId) {
    if (typeof sessionId !== 'string') return false
    return this.#records.delete(digestKey(sessionId))
  }

  cleanupExpired(now = this.#now()) {
    for (const [key, record] of this.#records) {
      if (record.idleExpiresAt <= now || record.absoluteExpiresAt <= now) this.#records.delete(key)
    }
  }

  get activeCount() {
    this.cleanupExpired()
    return this.#records.size
  }

  #publicRecord(record) {
    return {
      address: record.address,
      chainId: record.chainId,
      createdAt: record.createdAt,
      lastSeenAt: record.lastSeenAt,
      idleExpiresAt: record.idleExpiresAt,
      absoluteExpiresAt: record.absoluteExpiresAt,
    }
  }
}
