import type { PrismaClient } from '@go-ai/database'
import type { ProviderRegistry } from '@go-ai/ai-core'
import { NotFoundError, ForbiddenError } from '../lib/errors'
import type {
  CreateConversationInput,
  UpdateConversationInput,
  SearchConversationsInput,
  CreateFolderInput,
} from '@go-ai/shared'

export class ConversationService {
  constructor(private prisma: PrismaClient) {}

  async list(userId: string, page = 1, pageSize = 20, workspaceId?: string) {
    const skip = (page - 1) * pageSize
    const where = { userId, status: 'active' as const, workspaceId: workspaceId ?? null }

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          summary: true,
          model: true,
          provider: true,
          isPinned: true,
          isShared: true,
          tags: true,
          messageCount: true,
          tokenCount: true,
          lastMessageAt: true,
          folderId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.conversation.count({ where }),
    ])

    return {
      items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasNextPage: page * pageSize < total,
        hasPrevPage: page > 1,
      },
    }
  }

  async create(userId: string, input: CreateConversationInput) {
    return this.prisma.conversation.create({
      data: {
        userId,
        workspaceId: input.workspaceId,
        folderId: input.folderId,
        title: input.title ?? 'New Conversation',
        model: input.model ?? 'gpt-4o',
        provider: input.provider ?? 'openai',
        systemPrompt: input.systemPrompt,
        tags: input.tags ?? [],
      },
    })
  }

  async getById(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId, status: { not: 'deleted' } },
      include: {
        folder: { select: { id: true, name: true, color: true } },
      },
    })
    if (!conversation) throw new NotFoundError('Conversation')
    return conversation
  }

  async getMessages(userId: string, conversationId: string, cursor?: string, limit = 50) {
    await this.getById(userId, conversationId)

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        attachments: {
          include: {
            file: {
              select: {
                id: true,
                name: true,
                originalName: true,
                mimeType: true,
                size: true,
                publicUrl: true,
                status: true,
              },
            },
          },
        },
      },
    })

    return messages.reverse()
  }

  async update(userId: string, conversationId: string, input: UpdateConversationInput) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    })
    if (!conversation) throw new NotFoundError('Conversation')

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        title: input.title,
        systemPrompt: input.systemPrompt,
        folderId: input.folderId,
        tags: input.tags,
        isPinned: input.isPinned,
        isShared: input.isShared,
        shareToken: input.isShared
          ? conversation.shareToken ?? require('crypto').randomBytes(16).toString('hex')
          : input.isShared === false
          ? null
          : undefined,
      },
    })
  }

  async delete(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    })
    if (!conversation) throw new NotFoundError('Conversation')

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'deleted' },
    })
  }

  async bulkDelete(userId: string, ids: string[]) {
    await this.prisma.conversation.updateMany({
      where: { id: { in: ids }, userId },
      data: { status: 'deleted' },
    })
  }

  async archive(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
    })
    if (!conversation) throw new NotFoundError('Conversation')

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'archived' },
    })
  }

  async search(userId: string, params: SearchConversationsInput) {
    const { q, page = 1, pageSize = 20 } = params
    const skip = (page - 1) * pageSize

    // Full-text search in title and message content
    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where: {
          userId,
          status: 'active',
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { messages: { some: { content: { contains: q, mode: 'insensitive' } } } },
          ],
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          title: true,
          summary: true,
          model: true,
          lastMessageAt: true,
          messageCount: true,
        },
      }),
      this.prisma.conversation.count({
        where: {
          userId,
          status: 'active',
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { messages: { some: { content: { contains: q, mode: 'insensitive' } } } },
          ],
        },
      }),
    ])

    return { items: conversations, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } }
  }

  async getShared(shareToken: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { shareToken },
      include: {
        messages: {
          where: { status: 'complete' },
          orderBy: { createdAt: 'asc' },
          select: { role: true, content: true, createdAt: true, model: true },
        },
      },
    })
    if (!conversation || !conversation.isShared) throw new NotFoundError('Conversation')
    return conversation
  }

  // Folders
  async listFolders(userId: string) {
    return this.prisma.conversationFolder.findMany({
      where: { userId },
      orderBy: { order: 'asc' },
      include: { _count: { select: { conversations: true } } },
    })
  }

  async createFolder(userId: string, input: CreateFolderInput) {
    const maxOrder = await this.prisma.conversationFolder.count({ where: { userId } })
    return this.prisma.conversationFolder.create({
      data: { userId, name: input.name, color: input.color, icon: input.icon, order: maxOrder },
    })
  }

  async deleteFolder(userId: string, folderId: string) {
    const folder = await this.prisma.conversationFolder.findFirst({
      where: { id: folderId, userId },
    })
    if (!folder) throw new NotFoundError('Folder')

    // Move conversations to root
    await this.prisma.conversation.updateMany({
      where: { folderId },
      data: { folderId: null },
    })

    await this.prisma.conversationFolder.delete({ where: { id: folderId } })
  }
}

export async function generateConversationSummary(
  prisma: PrismaClient,
  ai: ProviderRegistry,
  conversationId: string
) {
  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        where: { status: 'complete' },
        orderBy: { createdAt: 'asc' },
        take: 10,
      },
    },
  })

  if (!conv || conv.messages.length < 2) return

  const transcript = conv.messages
    .slice(0, 6)
    .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
    .join('\n')

  try {
    const provider = await ai.getPreferred()
    const response = await provider.chat({
      model: 'gpt-4o-mini',
      provider: 'openai',
      messages: [
        {
          role: 'user',
          content: `Generate a concise title (max 50 chars) for this conversation. Return ONLY the title, nothing else:\n\n${transcript}`,
        },
      ],
      maxTokens: 60,
    })

    const title = response.content.trim().replace(/^["']|["']$/g, '')
    if (title && title.length > 0 && title.length <= 100) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      })
    }
  } catch {
    // Non-critical, ignore
  }
}
