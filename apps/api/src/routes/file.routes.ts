import type { FastifyInstance } from 'fastify'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { SUPPORTED_FILE_TYPES } from '@go-ai/shared'
import { QUEUES } from '../plugins/bullmq.plugin'
import { ValidationError, ForbiddenError, NotFoundError } from '../lib/errors'
import type { JwtPayload } from '../plugins/auth.plugin'
import { config } from '../config'

const ALL_SUPPORTED = [
  ...SUPPORTED_FILE_TYPES.images,
  ...SUPPORTED_FILE_TYPES.documents,
  ...SUPPORTED_FILE_TYPES.audio,
]

export default async function fileRoutes(app: FastifyInstance) {
  // POST /api/v1/files/upload
  app.post(
    '/upload',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = request.user as JwtPayload

      const parts = request.parts()
      const uploadedFiles = []

      for await (const part of parts) {
        if (part.type !== 'file') continue

        const mimeType = part.mimetype
        if (!ALL_SUPPORTED.includes(mimeType as never)) {
          throw new ValidationError(`Unsupported file type: ${mimeType}`)
        }

        const buffer = await part.toBuffer()
        const fileSizeMb = buffer.length / (1024 * 1024)

        if (fileSizeMb > config.MAX_FILE_SIZE_MB) {
          throw new ValidationError(
            `File too large. Maximum size is ${config.MAX_FILE_SIZE_MB}MB`
          )
        }

        const ext = path.extname(part.filename) || ''
        const storageKey = `${user.sub}/${uuidv4()}${ext}`

        const publicUrl = await app.storage.upload(storageKey, buffer, mimeType)

        const file = await app.prisma.file.create({
          data: {
            userId: user.sub,
            name: `${uuidv4()}${ext}`,
            originalName: part.filename,
            mimeType,
            size: buffer.length,
            storageKey,
            storageProvider: config.STORAGE_PROVIDER,
            publicUrl,
            status: 'pending',
          },
        })

        // Queue file processing
        await app.queues.get(QUEUES.FILE_PROCESSING)?.add('process', { fileId: file.id })

        uploadedFiles.push({
          id: file.id,
          name: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          publicUrl: file.publicUrl,
          status: file.status,
        })
      }

      return reply.status(201).send({ success: true, data: uploadedFiles })
    }
  )

  // GET /api/v1/files
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { page = 1, pageSize = 20, mimeType } = request.query as {
      page?: number
      pageSize?: number
      mimeType?: string
    }

    const skip = (Number(page) - 1) * Number(pageSize)

    const [files, total] = await Promise.all([
      app.prisma.file.findMany({
        where: {
          userId: user.sub,
          ...(mimeType ? { mimeType: { startsWith: mimeType } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(pageSize),
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          size: true,
          publicUrl: true,
          status: true,
          createdAt: true,
        },
      }),
      app.prisma.file.count({ where: { userId: user.sub } }),
    ])

    return reply.send({
      success: true,
      data: files,
      meta: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    })
  })

  // GET /api/v1/files/:id
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }

    const file = await app.prisma.file.findFirst({
      where: { id, userId: user.sub },
    })

    if (!file) throw new NotFoundError('File')

    return reply.send({ success: true, data: file })
  })

  // GET /api/v1/files/:id/status
  app.get('/:id/status', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }

    const file = await app.prisma.file.findFirst({
      where: { id, userId: user.sub },
      select: { id: true, status: true, extractedText: true },
    })

    if (!file) throw new NotFoundError('File')

    return reply.send({ success: true, data: file })
  })

  // DELETE /api/v1/files/:id
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }

    const file = await app.prisma.file.findFirst({ where: { id, userId: user.sub } })
    if (!file) throw new NotFoundError('File')

    await app.storage.delete(file.storageKey)
    await app.prisma.file.delete({ where: { id } })

    return reply.send({ success: true, data: { message: 'File deleted' } })
  })
}
