import { createServer } from 'node:http'

const port = Number(process.env.IPFS_PROXY_PORT ?? 8787)
const pinataJwt = process.env.PINATA_JWT
const pinataUploadUrl = 'https://uploads.pinata.cloud/v3/files'
const maxBodySize = 8 * 1024 * 1024
const maxImageSize = 5 * 1024 * 1024
const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const allowedOrigins = new Set(
  (process.env.IPFS_PROXY_ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)
const requestsByAddress = new Map()

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

function isRateLimited(address) {
  const now = Date.now()
  const windowStart = now - 60_000
  const recent = (requestsByAddress.get(address) ?? []).filter(
    (timestamp) => timestamp > windowStart,
  )
  recent.push(now)
  requestsByAddress.set(address, recent)
  return recent.length > 10
}

async function readJson(request) {
  const contentType = request.headers['content-type'] ?? ''
  if (!contentType.startsWith('application/json')) {
    throw Object.assign(new Error('Content-Type must be application/json.'), { status: 415 })
  }

  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > maxBodySize) {
      throw Object.assign(new Error('The upload request is too large.'), { status: 413 })
    }
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('The request body is not valid JSON.'), { status: 400 })
  }
}

function hasValidSignature(buffer, mimeType) {
  if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8
  if (mimeType === 'image/png') {
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  }
  if (mimeType === 'image/webp') {
    return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
  }
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

async function uploadPublicFile(file, name) {
  if (!pinataJwt) {
    throw Object.assign(
      new Error('The IPFS proxy is not configured. PINATA_JWT is missing.'),
      { status: 503 },
    )
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

async function uploadImage(request) {
  const body = await readJson(request)
  if (!allowedImageTypes.has(body.type) || !Number.isInteger(body.size) || body.size <= 0 || body.size > maxImageSize) {
    throw Object.assign(new Error('The image must be a JPG, PNG, or WebP file of at most 5 MB.'), { status: 400 })
  }
  if (typeof body.data !== 'string') {
    throw Object.assign(new Error('The image data is missing.'), { status: 400 })
  }

  const bytes = Buffer.from(body.data, 'base64')
  if (bytes.length !== body.size || !hasValidSignature(bytes, body.type)) {
    throw Object.assign(new Error('The image content does not match the declared file type.'), { status: 400 })
  }

  const name = cleanFileName(body.name)
  return await uploadPublicFile(new Blob([bytes], { type: body.type }), name)
}

async function uploadMetadata(request) {
  const body = await readJson(request)
  const title = requireText(body.title, 'title', 160)
  const description = requireText(body.description, 'description', 5000)
  const imageCid = body.imageCid === null ? null : requireText(body.imageCid, 'imageCid', 120)
  const metadata = { title, description, imageCid }
  const file = new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  return await uploadPublicFile(file, 'campaign-metadata.json')
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin
  if (origin && !allowedOrigins.has(origin)) {
    sendJson(response, 403, { error: 'This origin is not allowed.' })
    return
  }

  if (request.method === 'GET' && request.url === '/api/ipfs/health') {
    sendJson(response, 200, { ready: Boolean(pinataJwt) })
    return
  }

  if (request.method !== 'POST' || !request.url?.startsWith('/api/ipfs/')) {
    sendJson(response, 404, { error: 'Route not found.' })
    return
  }

  if (isRateLimited(request.socket.remoteAddress ?? 'unknown')) {
    sendJson(response, 429, { error: 'Too many upload attempts. Please wait and try again.' })
    return
  }

  try {
    let cid
    if (request.url === '/api/ipfs/image') cid = await uploadImage(request)
    else if (request.url === '/api/ipfs/metadata') cid = await uploadMetadata(request)
    else {
      sendJson(response, 404, { error: 'Route not found.' })
      return
    }
    sendJson(response, 201, { cid })
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500
    const message = status >= 500 && status !== 503
      ? 'The secure IPFS upload failed. Please try again.'
      : error?.message ?? 'The upload request is invalid.'
    if (status >= 500) console.error('IPFS proxy error:', error?.message ?? error)
    sendJson(response, status, { error: message })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Fundora IPFS proxy listening on http://127.0.0.1:${port}`)
})
