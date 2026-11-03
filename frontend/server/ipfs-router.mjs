import { Router, json } from 'express'
import { rateLimit } from 'express-rate-limit'

const pinataUploadUrl = 'https://uploads.pinata.cloud/v3/files'
const maxImageSize = 5 * 1024 * 1024
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

function hasValidSignature(buffer, mimeType) {
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
  return false
}

function requireText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw Object.assign(new Error(`${field} is invalid.`), { status: 400 })
  }
  return value.trim()
}

function cleanFileName(value) {
  const name = typeof value === 'string' ? value : 'campaign-image'
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'campaign-image'
}

async function uploadPublicFile(pinataJwt, file, name) {
  if (!pinataJwt) {
    throw Object.assign(new Error('The IPFS proxy is not configured. PINATA_JWT is missing.'), { status: 503 })
  }
  const form = new FormData()
  form.append('network', 'public')
  form.append('name', name)
  form.append('file', file, name)
  const pinataResponse = await fetch(pinataUploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pinataJwt}` },
    body: form,
    signal: AbortSignal.timeout(60_000),
  })
  const payload = await pinataResponse.json().catch(() => null)
  const cid = payload?.data?.cid
  if (!pinataResponse.ok || typeof cid !== 'string' || !cid) {
    throw Object.assign(new Error('Pinata could not complete the upload.'), { status: 502 })
  }
  return cid
}

async function uploadImage(pinataJwt, body) {
  if (!allowedImageTypes.has(body?.type) || !Number.isInteger(body?.size) || body.size <= 0 || body.size > maxImageSize) {
    throw Object.assign(new Error('The image must be a JPG, PNG, or WebP file of at most 5 MB.'), { status: 400 })
  }
  if (typeof body.data !== 'string') throw Object.assign(new Error('The image data is missing.'), { status: 400 })
  const bytes = Buffer.from(body.data, 'base64')
  if (bytes.length !== body.size || !hasValidSignature(bytes, body.type)) {
    throw Object.assign(new Error('The image content does not match the declared file type.'), { status: 400 })
  }
  const name = cleanFileName(body.name)
  return uploadPublicFile(pinataJwt, new Blob([bytes], { type: body.type }), name)
}

async function uploadMetadata(pinataJwt, body) {
  const title = requireText(body?.title, 'title', 160)
  const description = requireText(body?.description, 'description', 5000)
  const imageCid = body?.imageCid === null ? null : requireText(body?.imageCid, 'imageCid', 120)
  const file = new Blob([JSON.stringify({ title, description, imageCid })], { type: 'application/json' })
  return uploadPublicFile(pinataJwt, file, 'campaign-metadata.json')
}

export function createIpfsRouter({ pinataJwt }) {
  const router = Router()
  const uploadLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many upload attempts. Please wait and try again.' },
  })
  router.get('/health', (_request, response) => response.json({ ready: Boolean(pinataJwt) }))
  router.use((request, response, next) => {
    if (request.method === 'POST' && !request.is('application/json')) {
      response.status(415).json({ error: 'Content-Type must be application/json.' })
      return
    }
    next()
  })
  router.use(json({ limit: '8mb', strict: true, type: 'application/json' }))
  router.post('/image', uploadLimiter, async (request, response, next) => {
    try { response.status(201).json({ cid: await uploadImage(pinataJwt, request.body) }) } catch (error) { next(error) }
  })
  router.post('/metadata', uploadLimiter, async (request, response, next) => {
    try { response.status(201).json({ cid: await uploadMetadata(pinataJwt, request.body) }) } catch (error) { next(error) }
  })
  return router
}
