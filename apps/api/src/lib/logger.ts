import pino from 'pino'
import { config } from '../config'

export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    config.LOG_PRETTY && config.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        hostname: req.hostname,
        remoteAddress: req.ip,
      }
    },
    res(res) {
      return { statusCode: res.statusCode }
    },
  },
})
