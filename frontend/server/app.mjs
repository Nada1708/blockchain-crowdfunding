import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { createAuthRouter } from './auth-router.mjs'
import { createIpfsRouter } from './ipfs-router.mjs'
import { createOriginControl } from './origin-control.mjs'

export function createApp(config, dependencies = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy)
  app.use(helmet())
  app.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next() })
  app.use(createOriginControl(config.allowedOrigins))
  app.use('/api', rateLimit({
    windowMs: 15 * 60_000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please wait and try again.' },
  }))
  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
  app.use('/api/ipfs', createIpfsRouter(config))
  const auth = createAuthRouter(config, dependencies)
  app.use('/api/auth', auth.router)
  app.use('/api', (_request, response) => response.status(404).json({ error: 'Route not found.' }))
  app.use((error, _request, response, _next) => {
    const status = Number.isInteger(error?.status) ? error.status : 500
    const isIpfsError = typeof error?.message === 'string' && /image|metadata|Pinata|IPFS/i.test(error.message)
    const message = status >= 500 && status !== 503
      ? isIpfsError ? 'The secure IPFS upload failed. Please try again.' : 'The server could not complete the request.'
      : error?.type === 'entity.too.large' ? 'The request body is too large.'
        : error?.type === 'entity.parse.failed' ? 'The request body is not valid JSON.'
          : error?.message ?? 'The request is invalid.'
    if (status >= 500) console.error('Fundora API error:', error?.message ?? error)
    response.status(status).json({ error: message })
  })
  return { app, nonceStore: auth.nonceStore, sessionStore: auth.sessionStore }
}
