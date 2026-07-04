import type { PrismaClient } from '@go-ai/database'
import type { ProviderRegistry } from '@go-ai/ai-core'
import { logger } from '../lib/logger'

export async function updateMemory(
  prisma: PrismaClient,
  ai: ProviderRegistry,
  userId: string,
  conversationId: string
): Promise<void> {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId, status: 'complete' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    if (messages.length < 4) return

    const transcript = messages
      .reverse()
      .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
      .join('\n')

    const provider = await ai.getPreferred()

    const response = await provider.chat({
      model: 'gpt-4o-mini',
      provider: 'openai',
      messages: [
        {
          role: 'system',
          content:
            'Extract key facts about the user from this conversation. Include: preferences, goals, background, key decisions, important topics. Be concise. Return JSON: { "facts": ["fact1", "fact2", ...], "summary": "brief summary" }',
        },
        { role: 'user', content: transcript },
      ],
      maxTokens: 500,
    })

    let parsed: { facts: string[]; summary: string }
    try {
      const json = response.content.match(/\{[\s\S]*\}/)?.[0]
      parsed = JSON.parse(json ?? '{}')
    } catch {
      return
    }

    if (!parsed.facts?.length) return

    // Store each fact as a memory
    for (const fact of parsed.facts.slice(0, 10)) {
      const existing = await prisma.memory.findFirst({
        where: { userId, content: { contains: fact.slice(0, 50), mode: 'insensitive' } },
      })

      if (existing) {
        await prisma.memory.update({
          where: { id: existing.id },
          data: {
            content: fact,
            accessCount: { increment: 1 },
            lastAccessedAt: new Date(),
          },
        })
      } else {
        await prisma.memory.create({
          data: {
            userId,
            content: fact,
            summary: fact.slice(0, 100),
            sourceType: 'conversation',
            sourceId: conversationId,
            importance: 0.5,
          },
        })
      }
    }
  } catch (err) {
    logger.error({ err, userId, conversationId }, 'Memory update failed')
  }
}

export async function getRelevantMemories(
  prisma: PrismaClient,
  userId: string,
  query: string,
  limit = 5
): Promise<string[]> {
  const memories = await prisma.memory.findMany({
    where: { userId },
    orderBy: [{ importance: 'desc' }, { accessCount: 'desc' }],
    take: limit * 3,
  })

  if (!memories.length) return []

  // Simple keyword-based relevance (production would use vector search)
  const queryWords = query.toLowerCase().split(/\s+/)
  const scored = memories.map((m) => {
    const contentLower = m.content.toLowerCase()
    const score = queryWords.filter((w) => contentLower.includes(w)).length
    return { memory: m, score }
  })

  const relevant = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.memory.content)

  // Update access count
  const ids = scored.slice(0, limit).map((s) => s.memory.id)
  await prisma.memory.updateMany({
    where: { id: { in: ids } },
    data: { accessCount: { increment: 1 }, lastAccessedAt: new Date() },
  })

  return relevant
}
