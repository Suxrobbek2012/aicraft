// ============================================================
// O'ZBEK TILI UCHUN MAXSUS CHAT SERVICE - EMOJI VA KAYFIYAT BILAN
// ============================================================

import type { PrismaClient } from '@go-ai/database'
import type { ProviderRegistry } from '@go-ai/ai-core'
import type { FastifyInstance } from 'fastify'
import {
  PLAN_LIMITS,
  generateConversationTitle,
  calculateTokenCost,
  detectLanguage,
  type AIMessage,
  type AIProvider,
  type ChatStreamEvent,
} from '@go-ai/shared'
import type { SendMessageInput } from '@go-ai/shared'
import { QUEUES } from '../plugins/bullmq.plugin'
import {
  NotFoundError,
  ForbiddenError,
  PlanLimitError,
  AIProviderError,
} from '../lib/errors'
import { cacheGet, cacheSet, CACHE_PREFIX } from '../lib/redis'
import { SearchService } from './search.service'
import { getRelevantMemories } from './memory.service'

// ============================================================
// 1. EMOJI VA KAYFIYAT KLASSI
// ============================================================

class EmojiMoodManager {
  // Turli kayfiyatlar uchun emojilar
  private emojis = {
    greeting: ['👋', '😊', '✨', '🌟', '💫', '🤗'],
    happy: ['😄', '🎉', '🥳', '💪', '🔥', '⭐', '🌈'],
    sad: ['😔', '💔', '😢', '🌧️'],
    thinking: ['🤔', '💭', '🧠', '🤓'],
    success: ['✅', '🎯', '🏆', '💯', '👏', '🌟'],
    error: ['❌', '⚠️', '😅', '💥'],
    love: ['❤️', '💕', '💖', '💗', '🥰'],
    funny: ['😂', '🤣', '😆', '😹', '🤪'],
    cool: ['😎', '🔥', '💪', '🚀', '⚡'],
    question: ['🤔', '🧐', '❓', '🤷', '🤨'],
    idea: ['💡', '✨', '🎯', '💎', '🧠'],
    work: ['💻', '👨‍💻', '⚙️', '🔧', '🛠️'],
    book: ['📚', '📖', '📝', '✍️', '📓'],
    music: ['🎵', '🎶', '🎸', '🎹', '🎤'],
    food: ['🍕', '🍔', '🌮', '🥗', '🍜', '☕'],
    nature: ['🌿', '🌺', '🌻', '🌸', '🌳', '🌊'],
    star: ['⭐', '🌟', '✨', '💫'],
    heart: ['❤️', '🧡', '💛', '💚', '💙', '💜'],
    tech: ['💻', '🖥️', '📱', '⌨️', '🖱️', '🤖'],
  }

  // Xabarga mos emoji tanlash
  getEmoji(text: string, mood: string = 'neutral'): string {
    const lowerText = text.toLowerCase()
    
    // Salomlashish
    if (lowerText.includes('salom') || lowerText.includes('assalom') || lowerText.includes('hey')) {
      return this.randomFrom('greeting')
    }
    
    // Yaxshi, ajoyib
    if (lowerText.includes('yaxshi') || lowerText.includes('ajoyib') || lowerText.includes('zoʻr') || lowerText.includes('zo\'r')) {
      return this.randomFrom('happy')
    }
    
    // Rahmat
    if (lowerText.includes('rahmat') || lowerText.includes('tashakkur')) {
      return this.randomFrom('love')
    }
    
    // Savol
    if (lowerText.includes('?') || lowerText.includes('qanday') || lowerText.includes('nima') || lowerText.includes('kim')) {
      return this.randomFrom('question')
    }
    
    // Kulgili
    if (lowerText.includes('😂') || lowerText.includes('😆') || lowerText.includes('🤣')) {
      return this.randomFrom('funny')
    }
    
    // Dasturlash, kod
    if (lowerText.includes('kod') || lowerText.includes('code') || lowerText.includes('program') || lowerText.includes('api')) {
      return this.randomFrom('tech')
    }
    
    // Ish
    if (lowerText.includes('ish') || lowerText.includes('vazifa') || lowerText.includes('loyiha')) {
      return this.randomFrom('work')
    }
    
    return this.randomFrom('cool')
  }

  // Kayfiyatga mos emoji
  getMoodEmoji(mood: 'happy' | 'sad' | 'thinking' | 'cool' | 'love' | 'funny'): string {
    return this.randomFrom(mood)
  }

  // Tasodifiy emoji olish
  private randomFrom(category: keyof typeof this.emojis | string): string {
    const emojiList = this.emojis[category as keyof typeof this.emojis] || this.emojis.cool
    return emojiList[Math.floor(Math.random() * emojiList.length)]
  }

  // Matnga emoji qo'shish
  addEmojis(text: string, mood: string = 'neutral'): string {
    // Agar matnda emoji bo'lmasa
    if (!text.match(/[\u{1F600}-\u{1F6FF}]/u)) {
      const emoji = this.getEmoji(text, mood)
      // Jumla oxiriga emoji qo'shish
      const trimmed = text.trim()
      const punctuation = trimmed.match(/[.!?…]+$/)
      if (punctuation) {
        return trimmed.slice(0, -punctuation[0].length) + ' ' + emoji + punctuation[0]
      }
      return trimmed + ' ' + emoji
    }
    return text
  }

  // Kayfiyat aniqlash
  detectMood(text: string): 'happy' | 'sad' | 'thinking' | 'cool' | 'love' | 'funny' {
    const lowerText = text.toLowerCase()
    
    if (lowerText.includes('yaxshi') || lowerText.includes('ajoyib') || lowerText.includes('zoʻr') || lowerText.includes('zo\'r')) {
      return 'happy'
    }
    if (lowerText.includes('😂') || lowerText.includes('🤣') || lowerText.includes('😆')) {
      return 'funny'
    }
    if (lowerText.includes('?') || lowerText.includes('nima') || lowerText.includes('qanday')) {
      return 'thinking'
    }
    if (lowerText.includes('❤️') || lowerText.includes('💕') || lowerText.includes('rahmat')) {
      return 'love'
    }
    if (lowerText.includes('😎') || lowerText.includes('🔥')) {
      return 'cool'
    }
    if (lowerText.includes('😔') || lowerText.includes('💔') || lowerText.includes('yomon')) {
      return 'sad'
    }
    
    return 'cool'
  }
}

// ============================================================
// 2. O'ZBEK TILI FILTR VA TOZALASH KLASSI (EMOJI BILAN)
// ============================================================

class UzbekConversationFilter {
  private emojiManager: EmojiMoodManager

  constructor() {
    this.emojiManager = new EmojiMoodManager()
  }

  // Shablonli va keraksiz iboralarni olib tashlash
  removeTemplates(text: string): string {
    const templates = [
      /Assalomu alaykum!\s*/gi,
      /Xush kelibsiz!\s*/gi,
      /Sizni koʻrib xursandman!\s*/gi,
      /Sizga qanday yordam bera olaman\??\s*/gi,
      /Qanday yordam bera olaman\??\s*/gi,
      /Yordam berishdan mamnunman!\s*/gi,
      /Keling, buni koʻrib chiqaylik\.\s*/gi,
      /Xoʻsh, bu qiziq savol\.\s*/gi,
      /Men bu haqda shunday fikrdaman:\s*/gi,
      /Bu masalaga quyidagicha yondashamiz\.\s*/gi,
      /Bir soniya, oʻylab koʻray\.\.\.\s*/gi,
      /Keling, mulohaza qilaylik\.\.\.\s*/gi,
      /Endi buni tahlil qiladigan boʻlsak\.\.\.\s*/gi,
      /Tushundingizmi, aslida\.\.\.\s*/gi,
    ]
    
    let result = text
    for (const template of templates) {
      result = result.replace(template, '')
    }
    
    // Agar bo'sh bo'lib qolsa, oddiy javob
    if (!result.trim()) {
      const simpleReplies = [
        'Salom! 👋',
        'Nima gap? 😊',
        'Assalom! ✨',
        'Salom, qandaysiz? 🤗',
        'Hey! 👋',
        'Salom bro! 🔥',
      ]
      return simpleReplies[Math.floor(Math.random() * simpleReplies.length)]
    }
    
    return result.trim()
  }

  // Qisqa va lo'nda javob
  simplifyResponse(text: string): string {
    if (text.length > 300) {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim())
      if (sentences.length > 3) {
        return sentences.slice(0, 2).join('. ') + '.'
      }
    }
    return text
  }

  // Takrorlanuvchi so'zlarni olib tashlash
  removeRedundancies(text: string): string {
    const redundancies = [
      { from: /\b(menimcha|aslida|umuman olganda|rostini aytsam)\s+,\s*(menimcha|aslida|umuman olganda|rostini aytsam)/gi, to: '$1' },
      { from: /\b(juda)\s+(juda)\b/gi, to: '$1' },
      { from: /\b(haqiqatan)\s+(haqiqatan)\b/gi, to: '$1' },
      { from: /\b(albatta)\s+(albatta)\b/gi, to: '$1' },
      { from: /\b(shubhasiz)\s+(shubhasiz)\b/gi, to: '$1' },
      { from: /\b(juda)\s+(juda)\s+(juda)\b/gi, to: 'juda' },
    ]
    let result = text
    for (const { from, to } of redundancies) {
      result = result.replace(from, to)
    }
    return result
  }

  // Tabiiy javobga o'tkazish (EMOJI BILAN)
  naturalize(text: string): string {
    const lowerText = text.toLowerCase()
    
    // Salom
    if (lowerText.includes('salom') && text.length < 50) {
      const replies = [
        'Salom! 👋',
        'Assalom! ✨',
        'Salom, qandaysiz? 😊',
        'Nima gap? 🔥',
        'Salom bro! 🤗',
        'Hey, salom! 👋',
      ]
      return replies[Math.floor(Math.random() * replies.length)]
    }

    // Yaxshi
    if (lowerText.includes('yaxshi') && text.length < 30) {
      const replies = [
        'Yaxshi ekan! 👍',
        'Zoʻr! 🔥',
        'Ajoyib! ✨',
        'Yaxshi, hammasi joyidami? 😊',
        'Rahmat, yaxshi! 💪',
      ]
      return replies[Math.floor(Math.random() * replies.length)]
    }

    // Rahmat
    if (lowerText.includes('rahmat') || lowerText.includes('tashakkur')) {
      const replies = [
        'Rahmat! ❤️',
        'Oʻzingizga ham rahmat! 💕',
        'Marhamat! 🤗',
        'Doim yordamga tayyorman! 💪',
      ]
      return replies[Math.floor(Math.random() * replies.length)]
    }

    // Hisob-kitob
    if (lowerText.includes('+') || lowerText.includes('-') || lowerText.includes('*') || lowerText.includes('/')) {
      const replies = [
        'Hisoblab chiqdim! 🧮',
        'Mana natija! 📊',
        'Javob tayyor! ✅',
      ]
      if (text.length < 50) {
        return replies[Math.floor(Math.random() * replies.length)] + ' ' + text
      }
    }

    return text
  }

  // Asosiy tozalash funksiyasi (EMOJI BILAN)
  clean(text: string): string {
    let cleaned = text
    const mood = this.emojiManager.detectMood(cleaned)
    
    cleaned = this.removeTemplates(cleaned)
    cleaned = this.removeRedundancies(cleaned)
    cleaned = this.simplifyResponse(cleaned)
    cleaned = this.naturalize(cleaned)
    cleaned = this.emojiManager.addEmojis(cleaned, mood)
    
    return cleaned
  }

  // EmojiManager ni olish
  getEmojiManager(): EmojiMoodManager {
    return this.emojiManager
  }
}

// ============================================================
// 3. O'ZBEK TILI UCHUN SYSTEM PROMPT (EMOJI BILAN)
// ============================================================

class UzbekPromptBuilder {
  static getSystemPrompt(): string {
    return `Sen AICraft AI yordamchisan. Oddiy, jonli va tabiiy suhbat qil. 😊

QOIDALAR:
- Qisqa va lo'nda gapir. Keraksiz so'zlarni ishlatma. 💪
- "Salom" desa, "Salom! 👋" deb javob qaytar.
- Har bir gapni "menimcha", "aslida" deb boshlamay qo'y.
- Foydalanuvchi qanday yozsa, shunday uslubda javob ber.
- Ortiqcha rasmiyatchilikka borma.
- O'zingni hech qanday brend yoki boshqa AI deb atama.
- Agar javobing 3 gapdan uzun bo'lsa, qisqartir.
- Kayfiyatga mos emoji ishlat. 😄🎉✨
- Yaxshi xabarga quvonch, yomonga hamdardlik bildir. ❤️

NAMUNALAR:
❌ "Assalomu alaykum! Sizga qanday yordam bera olaman?"
✅ "Salom! Nima gap? 👋"

❌ "Bugun qanday ish qilmoqchisiz?"
✅ "Bugun nima qilyapsiz? 😊"

❌ "Men sizga bu masalada yordam bera olaman..."
✅ "Yordam beraman! 💪"

❌ "Bu juda muhim savol..."
✅ "Qiziq savol! 🤔"

Oddiy suhbatdosh bo'l. Shablonli javoblardan qoch. 
O'zbek tilida erkin va tabiiy gapir. 🔥`
  }

  static getStylePrompt(): string {
    return `Tabiiy va erkin suhbat qil. O'zbek tilida jonli gapir. Kayfiyatga mos emoji ishlat. 😊✨🎉 Keraksiz gaplarni tashla.`
  }

  static getRussianPrompt(): string {
    return `Ты AICraft, AI-ассистент. Отвечай просто и естественно. Используй эмодзи для настроения. 😊🎉✨ Коротко и по делу.`
  }

  static getEnglishPrompt(): string {
    return `You are AICraft, an AI assistant. Reply simply and naturally. Use emojis for mood. 😊🎉✨ Keep it short and to the point.`
  }
}

// ============================================================
// 4. ASOSIY CHAT SERVICE KLASSI (EMOJI BILAN)
// ============================================================

export class ChatService {
  private uzbekFilter: UzbekConversationFilter
  private emojiManager: EmojiMoodManager

  constructor(
    private prisma: PrismaClient,
    private ai: ProviderRegistry,
    private app: FastifyInstance
  ) {
    this.uzbekFilter = new UzbekConversationFilter()
    this.emojiManager = new EmojiMoodManager()
  }

  // ============================================================
  // 5. SYSTEM PROMPT METODI
  // ============================================================

  private getSystemPrompt(language: string = 'uz'): string {
    if (language === 'uz') {
      return UzbekPromptBuilder.getSystemPrompt()
    }
    if (language === 'ru') {
      return UzbekPromptBuilder.getRussianPrompt()
    }
    return UzbekPromptBuilder.getEnglishPrompt()
  }

  private getStylePrompt(language: string = 'uz'): string {
    if (language === 'uz') {
      return UzbekPromptBuilder.getStylePrompt()
    }
    return 'Be natural and conversational. Use emojis for mood. 😊✨🎉'
  }

  // ============================================================
  // 6. ASOSIY STREAM METODI
  // ============================================================

  async *streamMessage(
    userId: string,
    input: SendMessageInput
  ): AsyncGenerator<ChatStreamEvent, void, unknown> {
    try {
      // ─── 1. Validate user ─────────────────────────────────────────
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          plan: true, 
          status: true, 
          tokenBalance: true, 
          settings: true,
          language: true 
        },
      })

      if (!user) throw new NotFoundError('User')
      if (user.status === 'SUSPENDED' || user.status === 'DELETED') {
        throw new ForbiddenError('Account is not active')
      }

      const planLimits = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS]

      // ─── 2. Check daily limit ────────────────────────────────────
      if (planLimits.dailyMessages > 0) {
        const today = new Date().toISOString().split('T')[0]
        const countKey = `${CACHE_PREFIX.TOKEN_COUNT}daily:${userId}:${today}`
        const dailyCount = (await cacheGet<number>(countKey)) ?? 0

        if (dailyCount >= planLimits.dailyMessages) {
          const isOpeningNewChat = !input.conversationId
          const bonusKey = `${CACHE_PREFIX.TOKEN_COUNT}refill-bonus:${userId}:${today}`
          const bonusAlreadyUsed = (await cacheGet<boolean>(bonusKey)) ?? false

          if (isOpeningNewChat && !bonusAlreadyUsed) {
            const bonusMessages = Math.max(1, Math.ceil(planLimits.dailyMessages * 0.35))
            const refilledCount = Math.max(0, dailyCount - bonusMessages)
            await cacheSet(countKey, refilledCount, 86400)
            await cacheSet(bonusKey, true, 86400)
          } else {
            throw new PlanLimitError(
              `Kunlik xabar limiti tugadi (${planLimits.dailyMessages} ta). 😔`
            )
          }
        }
      }

      // ─── 3. Detect language ──────────────────────────────────────
      const userLanguage = user.language || 'uz'
      let detectedLanguage = userLanguage

      try {
        const detected = detectLanguage(input.content)
        if (detected) detectedLanguage = detected
      } catch {
        // Use default
      }

      // ─── 4. Resolve model & provider ────────────────────────────
      const userSettings = user.settings as any || {}
      let provider = (input.provider ?? userSettings.defaultProvider ?? 'ollama') as AIProvider
      let model = input.model ?? userSettings.defaultModel ?? 'llama3.2:3b'

      // O'zbek tili uchun modelni o'zgartirish
      if (model === 'llama3.2:1b' && detectedLanguage === 'uz') {
        model = 'llama3.2:3b'
        this.app.log.info('O\'zbek tili uchun model o\'zgartirildi: llama3.2:3b')
      }

      if (!this.ai.has(provider)) {
        const available = await this.ai.getAvailableProviders()
        if (available.length === 0) {
          throw new Error('No AI providers available.')
        }
        provider = available[0] as AIProvider
      }

      const aiProvider = this.ai.get(provider)
      if (!aiProvider) {
        throw new Error(`Provider ${provider} not available`)
      }

      if (provider === 'ollama') {
        try {
          const models = await aiProvider.listModels().catch(() => [])
          if (models.length > 0) {
            const modelExists = models.some((m: string) => 
              m.includes(model) || model.includes(m.replace('ollama/', ''))
            )
            if (!modelExists) {
              model = models[0].replace('ollama/', '')
            }
          }
        } catch (err) {
          // Use default
        }
      }

      // Check plan limits
      const allowedModels = planLimits.models as readonly string[]
      const isModelAllowed = allowedModels.some((pattern) => {
        if (pattern === '*') return true
        if (pattern.endsWith('/*')) {
          const providerPrefix = pattern.replace('/*', '')
          return provider === providerPrefix
        }
        return model === pattern || model.replace('ollama/', '') === pattern
      })

      if (!isModelAllowed) {
        model = allowedModels[0]?.replace('ollama/', '') || 'llama3.2:3b'
      }

      // ─── 5. Resolve or create conversation ──────────────────────
      let conversationId = input.conversationId
      let isNewConversation = false

      if (!conversationId) {
        const conv = await this.prisma.conversation.create({
          data: {
            userId,
            title: generateConversationTitle(input.content),
            model: model,
            provider: provider,
            systemPrompt: this.getSystemPrompt(detectedLanguage),
          },
        })
        conversationId = conv.id
        isNewConversation = true
      } else {
        const conv = await this.prisma.conversation.findFirst({
          where: { id: conversationId, userId },
        })
        if (!conv) throw new NotFoundError('Conversation')
      }

      // ─── 6. Fetch conversation history ──────────────────────────
      const historyMessages = await this.prisma.message.findMany({
        where: { conversationId, status: 'complete' },
        orderBy: { createdAt: 'asc' },
        take: 80,
        include: { attachments: { include: { file: true } } },
      })

      // ─── 7. Build AI messages ────────────────────────────────────
      const aiMessages: AIMessage[] = []

      // System prompt - EMOJI BILAN
      aiMessages.push({
        role: 'system',
        content: this.getSystemPrompt(detectedLanguage),
      })

      // Style prompt - EMOJI BILAN
      aiMessages.push({
        role: 'system',
        content: this.getStylePrompt(detectedLanguage),
      })

      // Add history
      for (const msg of historyMessages) {
        if (msg.attachments.length > 0 && msg.role === 'user') {
          const parts: any[] = [{ type: 'text', text: msg.content }]
          for (const att of msg.attachments) {
            if (att.file.mimeType.startsWith('image/') && att.file.publicUrl) {
              parts.push({
                type: 'image_url',
                image_url: { url: att.file.publicUrl },
              })
            }
          }
          aiMessages.push({ role: msg.role as AIMessage['role'], content: parts })
        } else {
          aiMessages.push({
            role: msg.role as AIMessage['role'],
            content: msg.content,
          })
        }
      }

      // Current user message
      const userContent = await this.buildUserContent(input)
      aiMessages.push({ role: 'user', content: userContent })

      // ─── 8. Save user message ────────────────────────────────────
      await this.prisma.message.create({
        data: {
          conversationId,
          userId,
          role: 'user',
          content: input.content,
          status: 'complete',
        },
      })

      // ─── 9. Create pending assistant message ────────────────────
      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId,
          userId,
          role: 'assistant',
          content: '',
          status: 'streaming',
          model,
          provider,
        },
      })

      // Kayfiyat emojisini yuborish
      const mood = this.emojiManager.detectMood(input.content)
      const moodEmoji = this.emojiManager.getMoodEmoji(mood)
      
      yield {
        type: 'start',
        messageId: assistantMessage.id,
      }

      if (isNewConversation) {
        yield { type: 'conversation_created', conversationId }
      }

      // ─── 10. Additional context ──────────────────────────────────
      let additionalContext = ''

      // Memories
      if (planLimits.features.memory && userSettings.memoryEnabled) {
        try {
          const memories = await getRelevantMemories(this.prisma, userId, input.content)
          if (memories.length > 0) {
            additionalContext += `\n\n[USER MEMORIES] 📝\n${memories.map((m) => `• ${m}`).join('\n')}`
          }
        } catch (err) {
          this.app.log.error(err, 'Failed to fetch memories')
        }
      }

      // Web Search
      if (input.webSearch && planLimits.features.plugins) {
        try {
          yield { type: 'delta', delta: '🔍 Qidirilmoqda...\n\n' }
          const searchService = new SearchService()
          const results = await searchService.search(input.content)
          if (results.length > 0) {
            additionalContext += `\n\n[WEB SEARCH RESULTS] 🌐\n${results
              .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}`)
              .join('\n\n')}`
          } else {
            yield { type: 'delta', delta: '⚠️ Natija topilmadi. 😔\n\n' }
          }
        } catch (err) {
          this.app.log.error(err, 'Web search failed')
          yield { type: 'delta', delta: '❌ Qidiruv muvaffaqiyatsiz. 😅\n\n' }
        }
      }

      if (additionalContext) {
        const contextMsg: AIMessage = {
          role: 'system',
          content: additionalContext.trim(),
        }
        aiMessages.splice(aiMessages.length - 1, 0, contextMsg)
      }

      // ─── 11. Stream from AI provider ────────────────────────────
      let fullContent = ''
      let inputTokens = 0
      let outputTokens = 0
      let finishReason = 'stop'
      const startTime = Date.now()

      try {
        const stream = aiProvider.chatStream({
          model: model,
          provider,
          messages: aiMessages,
          temperature: 0.7,
          maxTokens: input.maxTokens || 8192,
          stream: true,
        })

        for await (const chunk of stream) {
          if (chunk.type === 'delta' && chunk.delta) {
            fullContent += chunk.delta
            yield { type: 'delta', delta: chunk.delta }
          }

          if (chunk.type === 'done') {
            if (chunk.usage) {
              inputTokens = chunk.usage.inputTokens || 0
              outputTokens = chunk.usage.outputTokens || 0
            }
            finishReason = chunk.finishReason ?? 'stop'
          }
        }

        if (!fullContent.trim()) {
          throw new Error('AI hech qanday javob bermadi')
        }

      } catch (err) {
        const error = err as Error
        this.app.log.error(error, 'AI stream error')
        
        let errorMessage = `Kechirasiz, xatolik: ${error.message} 😔`
        if (detectedLanguage === 'en') {
          errorMessage = `Sorry, error: ${error.message} 😔`
        } else if (detectedLanguage === 'ru') {
          errorMessage = `Извините, ошибка: ${error.message} 😔`
        }
        
        fullContent = errorMessage
        
        await this.prisma.message.update({
          where: { id: assistantMessage.id },
          data: { 
            status: 'error', 
            content: errorMessage 
          },
        })
        
        yield { type: 'error', error: error.message }
        return
      }

      const latencyMs = Date.now() - startTime

      // ─── 12. O'ZBEK TILI UCHUN TOZALASH (EMOJI BILAN) ──────────
      if (detectedLanguage === 'uz') {
        try {
          fullContent = this.uzbekFilter.clean(fullContent)
        } catch (error) {
          this.app.log.warn('Uzbek cleaning failed, using original')
        }
      }

      // ─── 13. Save completed message ──────────────────────────────
      await this.prisma.message.update({
        where: { id: assistantMessage.id },
        data: {
          content: fullContent,
          status: 'complete',
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          latencyMs,
          finishReason,
        },
      })

      // Update conversation
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          messageCount: { increment: 2 },
          tokenCount: { increment: inputTokens + outputTokens },
          lastMessageAt: new Date(),
        },
      })

      // ─── 14. Background jobs ─────────────────────────────────────
      const modelConfig = await this.prisma.aIModelConfig.findUnique({
        where: { modelId: model },
        select: { inputPricePerMillion: true, outputPricePerMillion: true },
      })

      const costUsd = modelConfig
        ? calculateTokenCost(
            inputTokens,
            outputTokens,
            modelConfig.inputPricePerMillion,
            modelConfig.outputPricePerMillion
          )
        : 0

      await this.app.queues.get(QUEUES.USAGE_TRACKING)?.add('track', {
        userId,
        model,
        provider,
        inputTokens,
        outputTokens,
        costUsd,
        conversationId,
        messageId: assistantMessage.id,
      })

      // Daily counter
      const today = new Date().toISOString().split('T')[0]
      const countKey = `${CACHE_PREFIX.TOKEN_COUNT}daily:${userId}:${today}`
      const currentCount = (await cacheGet<number>(countKey)) ?? 0
      await cacheSet(countKey, currentCount + 1, 86400)

      // Memory update
      if (userSettings.memoryEnabled) {
        await this.app.queues.get(QUEUES.MEMORY_UPDATE)?.add(
          'update',
          { userId, conversationId },
          { delay: 5000 }
        )
      }

      // Auto-generate title
      if (historyMessages.length === 0) {
        await this.app.queues.get(QUEUES.CONVERSATION_SUMMARY)?.add(
          'title',
          { conversationId },
          { delay: 2000 }
        )
      }

      yield {
        type: 'usage',
        usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      }

      yield { type: 'done', messageId: assistantMessage.id, finishReason }

    } catch (err) {
      const error = err as Error
      this.app.log.error(error, 'Chat service error')
      yield { type: 'error', error: error.message }
    }
  }

  // ============================================================
  // 15. YORDAMCHI METODLAR
  // ============================================================

  private async buildUserContent(input: SendMessageInput): Promise<AIMessage['content']> {
    if (!input.attachmentIds?.length) {
      return input.content
    }

    const files = await this.prisma.file.findMany({
      where: { id: { in: input.attachmentIds } },
    })

    const parts: any[] = [{ type: 'text', text: input.content }]

    for (const file of files) {
      if (file.mimeType.startsWith('image/') && file.publicUrl) {
        parts.push({
          type: 'image_url',
          image_url: { url: file.publicUrl, detail: 'auto' },
        })
      } else if (file.extractedText) {
        const extension = file.originalName.split('.').pop()?.toUpperCase() ?? 'FILE'
        parts.push({
          type: 'text',
          text: `\n\n--- ${extension}: ${file.originalName} ---\n${file.extractedText}\n---`,
        })
      }
    }

    return parts
  }

  async regenerateMessage(userId: string, messageId: string): Promise<string> {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, userId, role: 'assistant' },
      include: { conversation: true },
    })
    if (!message) throw new NotFoundError('Message')

    await this.prisma.message.delete({ where: { id: messageId } })
    return message.conversationId
  }

  async editMessage(userId: string, messageId: string, content: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, userId, role: 'user' },
    })
    if (!message) throw new NotFoundError('Message')

    await this.prisma.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
    })
  }

  // EmojiManager ni olish
  getEmojiManager(): EmojiMoodManager {
    return this.emojiManager
  }
}

export default ChatService