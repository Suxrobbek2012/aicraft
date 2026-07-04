import type { FastifyInstance } from 'fastify'
import { ConversationService } from '../services/conversation.service'
import {
  CreateConversationSchema,
  UpdateConversationSchema,
  SearchConversationsSchema,
  CreateFolderSchema,
} from '@go-ai/shared'
import type { JwtPayload } from '../plugins/auth.plugin'

export default async function conversationRoutes(app: FastifyInstance) {
  const getService = () => new ConversationService(app.prisma)

  // GET /api/v1/conversations
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { page, pageSize, workspaceId } = request.query as {
      page?: number
      pageSize?: number
      workspaceId?: string
    }
    const result = await getService().list(user.sub, page, pageSize, workspaceId)
    return reply.send({ success: true, ...result })
  })

  // POST /api/v1/conversations
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const input = CreateConversationSchema.parse(request.body)
    const conv = await getService().create(user.sub, input)
    return reply.status(201).send({ success: true, data: conv })
  })

  // GET /api/v1/conversations/search
  app.get('/search', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const params = SearchConversationsSchema.parse(request.query)
    const result = await getService().search(user.sub, params)
    return reply.send({ success: true, ...result })
  })

  // GET /api/v1/conversations/shared/:shareToken
  app.get('/shared/:shareToken', async (request, reply) => {
    const { shareToken } = request.params as { shareToken: string }
    const conv = await getService().getShared(shareToken)
    return reply.send({ success: true, data: conv })
  })

  // GET /api/v1/conversations/:id
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }
    const conv = await getService().getById(user.sub, id)
    return reply.send({ success: true, data: conv })
  })

  // PATCH /api/v1/conversations/:id
  app.patch('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }
    const input = UpdateConversationSchema.parse(request.body)
    const conv = await getService().update(user.sub, id, input)
    return reply.send({ success: true, data: conv })
  })

  // DELETE /api/v1/conversations/:id
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }
    await getService().delete(user.sub, id)
    return reply.send({ success: true, data: { message: 'Conversation deleted' } })
  })

  // POST /api/v1/conversations/bulk-delete
  app.post('/bulk-delete', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { ids } = request.body as { ids: string[] }
    await getService().bulkDelete(user.sub, ids)
    return reply.send({ success: true, data: { message: `${ids.length} conversations deleted` } })
  })

  // POST /api/v1/conversations/:id/archive
  app.post('/:id/archive', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }
    const conv = await getService().archive(user.sub, id)
    return reply.send({ success: true, data: conv })
  })

  // GET /api/v1/conversations/:id/messages
  app.get('/:id/messages', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }
    const { cursor, limit } = request.query as { cursor?: string; limit?: number }
    const messages = await getService().getMessages(user.sub, id, cursor, limit)
    return reply.send({ success: true, data: messages })
  })

  // ─── Folders ────────────────────────────────────────────────────────────────

  // GET /api/v1/conversations/folders
  app.get('/folders/list', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const folders = await getService().listFolders(user.sub)
    return reply.send({ success: true, data: folders })
  })

  // POST /api/v1/conversations/folders
  app.post('/folders', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const input = CreateFolderSchema.parse(request.body)
    const folder = await getService().createFolder(user.sub, input)
    return reply.status(201).send({ success: true, data: folder })
  })

  // DELETE /api/v1/conversations/folders/:id
  app.delete('/folders/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }
    await getService().deleteFolder(user.sub, id)
    return reply.send({ success: true, data: { message: 'Folder deleted' } })
  })
}
