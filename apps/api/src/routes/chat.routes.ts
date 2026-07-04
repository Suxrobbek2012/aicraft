import type { FastifyInstance } from 'fastify'
import { ChatService } from '../services/chat.service'
import { SendMessageSchema } from '@go-ai/shared'
import type { JwtPayload } from '../plugins/auth.plugin'

export default async function chatRoutes(app: FastifyInstance) {
  // POST /api/v1/chat/stream
  app.post(
    '/stream',
    {
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const user = request.user as JwtPayload
      const input = SendMessageSchema.parse(request.body)

      const chatService = new ChatService(app.prisma, app.ai, app)

      // SSE headers
      const origin = request.headers.origin ?? '*'
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
      })

      const write = (data: string) => {
        try {
          reply.raw.write(`data: ${data}\n\n`)
        } catch (err) {
          app.log.error(err, 'Failed to write SSE data')
        }
      }

      try {
        for await (const event of chatService.streamMessage(user.sub, input)) {
          write(JSON.stringify(event))
        }
      } catch (err) {
        const error = err as Error
        app.log.error(error, 'Stream error')
        write(JSON.stringify({ type: 'error', error: error.message }))
      } finally {
        try {
          reply.raw.end()
        } catch (err) {
          app.log.error(err, 'Failed to end stream')
        }
      }
    }
  )

  // POST /api/v1/chat/stream/api
  app.post(
    '/stream/api',
    {
      preHandler: [app.authenticateApiKey],
    },
    async (request, reply) => {
      const user = request.user as JwtPayload
      const input = SendMessageSchema.parse(request.body)
      const chatService = new ChatService(app.prisma, app.ai, app)

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      })

      const write = (data: string) => {
        try {
          reply.raw.write(`data: ${data}\n\n`)
        } catch (err) {
          app.log.error(err, 'Failed to write SSE data')
        }
      }

      try {
        for await (const event of chatService.streamMessage(user.sub, input)) {
          write(JSON.stringify(event))
        }
      } catch (err) {
        const error = err as Error
        app.log.error(error, 'Stream error')
        write(JSON.stringify({ type: 'error', error: error.message }))
      } finally {
        try {
          reply.raw.end()
        } catch (err) {
          app.log.error(err, 'Failed to end stream')
        }
      }
    }
  )

  // POST /api/v1/chat/messages/:messageId/edit
  app.post(
    '/messages/:messageId/edit',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload
      const { messageId } = request.params as { messageId: string }
      const { content } = request.body as { content: string }

      const chatService = new ChatService(app.prisma, app.ai, app)
      await chatService.editMessage(user.sub, messageId, content)

      return reply.send({ success: true, data: { message: 'Message updated' } })
    }
  )

  // POST /api/v1/chat/messages/:messageId/regenerate
  app.post(
    '/messages/:messageId/regenerate',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload
      const { messageId } = request.params as { messageId: string }

      const chatService = new ChatService(app.prisma, app.ai, app)
      const conversationId = await chatService.regenerateMessage(user.sub, messageId)

      return reply.send({ success: true, data: { conversationId } })
    }
  )

  // POST /api/v1/chat/tts
  app.post('/tts', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { text, voice = 'alloy', speed = 1.0 } = request.body as {
      text: string
      voice?: string
      speed?: number
    }

    if (!text || text.length > 4096) {
      return reply.status(400).send({ 
        success: false, 
        error: { code: 'VALIDATION_ERROR', message: 'Invalid text' } 
      })
    }

    try {
      const OpenAI = (await import('openai')).default
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

      const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: voice as 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer',
        input: text,
        speed,
      })

      const buffer = Buffer.from(await response.arrayBuffer())

      reply.header('Content-Type', 'audio/mpeg')
      return reply.send(buffer)
    } catch (err) {
      const error = err as Error
      app.log.error(error, 'TTS error')
      return reply.status(500).send({
        success: false,
        error: { code: 'TTS_ERROR', message: error.message }
      })
    }
  })
}