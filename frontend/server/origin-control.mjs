const ALLOWED_METHODS = 'GET,POST,DELETE,OPTIONS'
const ALLOWED_HEADERS = 'Content-Type,X-CSRF-Token'

export function createOriginControl(allowedOrigins) {
  return function originControl(request, response, next) {
    const origin = request.get('origin')
    if (origin && !allowedOrigins.has(origin)) {
      response.status(403).json({ error: 'This origin is not allowed.' })
      return
    }
    if (origin) {
      response.set('Access-Control-Allow-Origin', origin)
      response.set('Access-Control-Allow-Credentials', 'true')
      response.set('Access-Control-Allow-Methods', ALLOWED_METHODS)
      response.set('Access-Control-Allow-Headers', ALLOWED_HEADERS)
      response.vary('Origin')
    }
    if (request.method === 'OPTIONS') {
      response.sendStatus(204)
      return
    }
    next()
  }
}
