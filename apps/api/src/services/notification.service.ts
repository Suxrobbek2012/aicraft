import type { PrismaClient } from '@go-ai/database'

interface CreateNotificationInput {
  userId: string
  type?: 'info' | 'success' | 'warning' | 'error' | 'system'
  title: string
  body: string
  link?: string
  metadata?: Record<string, unknown>
}

export async function createNotification(
  prisma: PrismaClient,
  input: CreateNotificationInput
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type ?? 'info',
      title: input.title,
      body: input.body,
      link: input.link,
      metadata: input.metadata as any,
    },
  })
}
