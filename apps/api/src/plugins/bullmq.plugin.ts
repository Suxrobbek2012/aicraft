import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { Queue, Worker, type Job } from 'bullmq'
import { getRedis } from '../lib/redis'
import { logger } from '../lib/logger'

export const QUEUES = {
  EMAIL: 'email',
  FILE_PROCESSING: 'file-processing',
  MEMORY_UPDATE: 'memory-update',
  CONVERSATION_SUMMARY: 'conversation-summary',
  USAGE_TRACKING: 'usage-tracking',
  NOTIFICATION: 'notification',
  CLEANUP: 'cleanup',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

const workers: Worker[] = []
const queues = new Map<string, Queue>()

export const bullmqPlugin = fp(async (app: FastifyInstance) => {
  const connection = getRedis() as any

  // Create queues
  for (const name of Object.values(QUEUES)) {
    const queue = new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    })
    queues.set(name, queue)
  }

  // ─── File Processing Worker ────────────────────────────────────────────────
  const fileWorker = new Worker(
    QUEUES.FILE_PROCESSING,
    async (job: Job) => {
      const { fileId } = job.data as { fileId: string }
      const { processFile } = await import('../services/file-processor.service')
      await processFile(app.prisma, fileId)
    },
    { connection, concurrency: 3 }
  )

  // ─── Memory Update Worker ──────────────────────────────────────────────────
  const memoryWorker = new Worker(
    QUEUES.MEMORY_UPDATE,
    async (job: Job) => {
      const { userId, conversationId } = job.data as { userId: string; conversationId: string }
      const { updateMemory } = await import('../services/memory.service')
      await updateMemory(app.prisma, app.ai, userId, conversationId)
    },
    { connection, concurrency: 5 }
  )

  // ─── Conversation Summary Worker ───────────────────────────────────────────
  const summaryWorker = new Worker(
    QUEUES.CONVERSATION_SUMMARY,
    async (job: Job) => {
      const { conversationId } = job.data as { conversationId: string }
      const { generateConversationSummary } = await import('../services/conversation.service')
      await generateConversationSummary(app.prisma, app.ai, conversationId)
    },
    { connection, concurrency: 5 }
  )

  // ─── Usage Tracking Worker ─────────────────────────────────────────────────
  const usageWorker = new Worker(
    QUEUES.USAGE_TRACKING,
    async (job: Job) => {
      const data = job.data as {
        userId: string
        model: string
        provider: string
        inputTokens: number
        outputTokens: number
        costUsd: number
        conversationId?: string
        messageId?: string
      }
      const { trackUsage } = await import('../services/usage.service')
      await trackUsage(app.prisma, data)
    },
    { connection, concurrency: 10 }
  )

  // ─── Email Worker ──────────────────────────────────────────────────────────
  const emailWorker = new Worker(
    QUEUES.EMAIL,
    async (job: Job) => {
      const { sendEmail } = await import('../services/email.service')
      await sendEmail(job.data)
    },
    { connection, concurrency: 5 }
  )

  // ─── Notification Worker ───────────────────────────────────────────────────
  const notifWorker = new Worker(
    QUEUES.NOTIFICATION,
    async (job: Job) => {
      const { createNotification } = await import('../services/notification.service')
      await createNotification(app.prisma, job.data)
    },
    { connection, concurrency: 10 }
  )

  workers.push(fileWorker, memoryWorker, summaryWorker, usageWorker, emailWorker, notifWorker)

  // Error handlers
  for (const worker of workers) {
    worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, queue: worker.name, err }, 'Job failed')
    })
    worker.on('completed', (job) => {
      logger.debug({ jobId: job.id, queue: worker.name }, 'Job completed')
    })
  }

  app.decorate('queues', queues)

  app.addHook('onClose', async () => {
    await Promise.all(workers.map((w) => w.close()))
    await Promise.all(Array.from(queues.values()).map((q) => q.close()))
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    queues: Map<string, Queue>
  }
}
