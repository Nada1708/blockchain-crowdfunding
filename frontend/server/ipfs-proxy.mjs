import { createApp } from './app.mjs'
import { loadConfig } from './config.mjs'

try {
  const config = loadConfig()
  const { app } = createApp(config)

  app.listen(config.port, config.host, () => {
    console.log(`Fundora API listening on http://${config.host}:${config.port}`)
  })
} catch (error) {
  console.error('Fundora API configuration error:', error?.message ?? error)
  process.exitCode = 1
}
