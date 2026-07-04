import { config } from './config'
import { buildApp } from './app'
import { logger } from './lib/logger'

async function start() {
  const app = await buildApp()

  try {
    await app.listen({ port: config.PORT, host: config.HOST })
    logger.info(`🚀 aicraft API running on http://${config.HOST}:${config.PORT}`)
    logger.info(`📚 API docs: http://${config.HOST}:${config.PORT}/docs`)
    logger.info(`🌍 Environment: ${config.NODE_ENV}`)
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM', 'SIGUSR2'] as const
for (const signal of signals) {
  process.on(signal, async () => {
    logger.info(`Received ${signal}, shutting down gracefully...`)
    process.exit(0)
  })
}

start()
