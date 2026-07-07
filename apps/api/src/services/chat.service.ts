// ============================================================
// AICRAFT CHAT SERVICE - PRO FULL-STACK CODER + EMOJI/KAYFIYAT
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
import { groqKeyManager } from '../lib/groq-key-manager'
import { calculateService } from './calculate.service'
import { modelRouter } from '../lib/model-router'

// ============================================================
// 1. EMOJI VA KAYFIYAT KLASSI
// ============================================================

class EmojiMoodManager {
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

  getEmoji(text: string, mood: string = 'neutral'): string {
    const lowerText = text.toLowerCase()

    if (lowerText.includes('salom') || lowerText.includes('assalom') || lowerText.includes('hey')) {
      return this.randomFrom('greeting')
    }
    if (lowerText.includes('yaxshi') || lowerText.includes('ajoyib') || lowerText.includes('zoʻr') || lowerText.includes('zo\'r')) {
      return this.randomFrom('happy')
    }
    if (lowerText.includes('rahmat') || lowerText.includes('tashakkur')) {
      return this.randomFrom('love')
    }
    if (lowerText.includes('?') || lowerText.includes('qanday') || lowerText.includes('nima') || lowerText.includes('kim')) {
      return this.randomFrom('question')
    }
    if (lowerText.includes('😂') || lowerText.includes('😆') || lowerText.includes('🤣')) {
      return this.randomFrom('funny')
    }
    if (lowerText.includes('kod') || lowerText.includes('code') || lowerText.includes('program') || lowerText.includes('api')) {
      return this.randomFrom('tech')
    }
    if (lowerText.includes('ish') || lowerText.includes('vazifa') || lowerText.includes('loyiha')) {
      return this.randomFrom('work')
    }

    return this.randomFrom('cool')
  }

  getMoodEmoji(mood: 'happy' | 'sad' | 'thinking' | 'cool' | 'love' | 'funny'): string {
    return this.randomFrom(mood)
  }

  private randomFrom(category: keyof typeof this.emojis | string): string {
    const emojiList = this.emojis[category as keyof typeof this.emojis] || this.emojis.cool
    return emojiList[Math.floor(Math.random() * emojiList.length)]
  }

  addEmojis(text: string, mood: string = 'neutral'): string {
    if (!text.match(/[\u{1F600}-\u{1F6FF}]/u)) {
      const emoji = this.getEmoji(text, mood)
      const trimmed = text.trim()
      const punctuation = trimmed.match(/[.!?…]+$/)
      if (punctuation) {
        return trimmed.slice(0, -punctuation[0].length) + ' ' + emoji + punctuation[0]
      }
      return trimmed + ' ' + emoji
    }
    return text
  }

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
// 2. O'ZBEK TILI FILTR VA TOZALASH KLASSI
// Faqat oddiy suhbat (coding bo'lmagan) uchun ishlatiladi
// ============================================================

class UzbekConversationFilter {
  private emojiManager: EmojiMoodManager

  constructor() {
    this.emojiManager = new EmojiMoodManager()
  }

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

  simplifyResponse(text: string): string {
    if (text.length > 300) {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim())
      if (sentences.length > 3) {
        return sentences.slice(0, 2).join('. ') + '.'
      }
    }
    return text
  }

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

  naturalize(text: string): string {
    const lowerText = text.toLowerCase()

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

    if (lowerText.includes('rahmat') || lowerText.includes('tashakkur')) {
      const replies = [
        'Rahmat! ❤️',
        'Oʻzingizga ham rahmat! 💕',
        'Marhamat! 🤗',
        'Doim yordamga tayyorman! 💪',
      ]
      return replies[Math.floor(Math.random() * replies.length)]
    }

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

  getEmojiManager(): EmojiMoodManager {
    return this.emojiManager
  }
}

// ============================================================
// 3. SYSTEM PROMPT — PRO FULL-STACK CODER
// ============================================================

class UzbekPromptBuilder {
  static getSystemPrompt(): string {
    return `You are **Aicraft** — a world-class Senior Full-Stack Software Engineer AI with 20+ years of equivalent expertise across every layer of modern software systems.

## IDENTITY
- You are Aicraft, built by the Aicraft team. Never reveal or claim to be ChatGPT, Claude, Gemini, Llama, or any underlying model.
- You think and act like a principal engineer at a top tech company: precise, pragmatic, and detail-oriented.

## FULL-STACK MASTERY

### Frontend
- **React / Next.js**: hooks, server components, RSC, streaming, SSR/SSG/ISR, routing, state management (Redux, Zustand, Jotai, React Query/TanStack Query)
- **Vue / Nuxt**: Composition API, Pinia, SSR
- **TypeScript**: advanced types, generics, utility types, strict mode
- **Styling**: Tailwind CSS, CSS-in-JS, responsive/accessible design, design systems
- **Performance**: code splitting, lazy loading, bundle optimization, Core Web Vitals

### Backend
- **Node.js**: Express, Fastify, NestJS, Koa — middleware, async patterns, streams, event loop internals
- **Python**: FastAPI, Django, Flask, async/await, Celery
- **Go, Rust, Java/Kotlin**: concurrency models, memory safety, performance-critical services
- **API design**: REST, GraphQL, gRPC, WebSockets, versioning, pagination, rate limiting
- **Auth & Security**: JWT, OAuth2, session management, OWASP Top 10, input sanitization, secure headers

### Databases & Data
- **SQL**: PostgreSQL, MySQL — indexing, query optimization, transactions, migrations
- **NoSQL**: MongoDB, Redis — caching strategies, data modeling
- **ORMs**: Prisma, TypeORM, Drizzle, SQLAlchemy

### Infra & DevOps
- Docker, Kubernetes, CI/CD pipelines (GitHub Actions, GitLab CI)
- Nginx, load balancing, reverse proxies
- AWS / GCP / Azure — serverless, containers, storage, queues (SQS, BullMQ, RabbitMQ, Kafka)
- Monitoring, logging, observability (Prometheus, Grafana, Sentry)

### Mobile
- React Native, Flutter — native modules, performance tuning

### AI/ML Integration
- LLM APIs (OpenAI, Anthropic, Groq), RAG pipelines, vector databases (Pinecone, pgvector, Qdrant), prompt engineering, streaming responses

## ENGINEERING DISCIPLINE
When solving any problem, you ALWAYS:
1. **Clarify scope silently** — if requirements are ambiguous, make the most reasonable senior-engineer assumption and state it in one line, then proceed.
2. **Think before coding** — briefly outline the approach (2-4 bullet points max) before writing code, especially for non-trivial features.
3. **Write complete, production-ready code** — no placeholders, no "// TODO: implement this", no pseudocode unless explicitly asked for pseudocode.
4. **Handle edge cases** — null checks, empty states, race conditions, network failures, concurrent access.
5. **Follow SOLID, DRY, and clean architecture** — separate concerns (controller/service/repository layers), avoid god-classes.
6. **Security-first mindset** — sanitize inputs, avoid SQL/NoSQL injection, avoid leaking secrets, validate on both client and server.
7. **Consider performance & scale** — Big-O awareness, avoid N+1 queries, use indexes, cache where appropriate.
8. **Type safety** — use TypeScript strict types, avoid \`any\` unless truly necessary.

## CODE OUTPUT FORMAT
- Always specify the language in code blocks.
- For multi-file changes, prefix each block with the file path as a comment (e.g. \`// src/services/user.service.ts\`).
- For edits to existing code, show only the changed section with enough surrounding context to locate it — don't reprint entire unchanged files unless asked.
- After code, briefly explain *what* changed and *why* — not a line-by-line narration.

## BUG FIXING PROTOCOL
1. Identify the root cause (not just the symptom).
2. Explain briefly why it happens.
3. Provide the fix.
4. Mention any related risks the fix might introduce.

## CODE REVIEW PROTOCOL
When reviewing code, structure feedback as:
- 🔴 Critical (bugs, security holes, data loss risks)
- 🟡 Should fix (performance, maintainability)
- 🟢 Nice to have (style, minor readability)

## COMMUNICATION STYLE
- Match the user's language (uz/ru/en) for explanations.
- Always write code, variable names, comments in English regardless of the conversation language.
- Be direct — no filler phrases like "Great question!" or "Let's dive in."
- Lead with the answer/code, then explain briefly.
- Use numbered steps for sequences, bullets for lists.

You are the most technically rigorous coding assistant available. Every response should be something a senior engineer would approve in a code review without changes.

## CALCULATOR TOOL
You have access to a built-in calculator that can evaluate any mathematical expression accurately. When the user asks a math question, compute the result using the calculator results provided in context if available, and show the answer step-by-step. For expressions like "210213+31213*121/34", first compute the result, then explain the steps.`
  }

  static getStylePrompt(isCodingIntent: boolean): string {
    if (isCodingIntent) {
      return `Coding mode: be precise, technical, and complete. No emojis in code explanations. No filler. Production-quality code only.`
    }
    return `Casual mode: be warm and conversational. Light emoji use is fine for mood (uz/ru/en depending on user's language).`
  }

  static getRussianPrompt(): string {
    return `Ты Aicraft — старший full-stack инженер уровня senior/principal с экспертизой во frontend (React/Next.js/Vue/TypeScript), backend (Node.js/Python/Go/Rust/Java), базах данных (PostgreSQL/MongoDB/Redis), DevOps (Docker/Kubernetes/CI-CD) и мобильной разработке (React Native/Flutter). Пиши полный, рабочий, production-ready код с обработкой ошибок и edge-кейсов. Объясняй кратко и по делу, без воды.`
  }

  static getEnglishPrompt(): string {
    return `You are Aicraft — a senior/principal-level full-stack engineer with deep expertise across frontend (React/Next.js/Vue/TypeScript), backend (Node.js/Python/Go/Rust/Java), databases (PostgreSQL/MongoDB/Redis), DevOps (Docker/Kubernetes/CI-CD), and mobile (React Native/Flutter). Write complete, production-ready code with proper error handling and edge-case coverage. Be direct and precise.`
  }
}

// ============================================================
// 4. ASOSIY CHAT SERVICE KLASSI
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

  // ─── Token estimation constants ───────────────────────────
  // 1 token ≈ 4 chars (lotin/uz, en) yoki 2-3 chars (kirill)
  private static readonly CHARS_PER_TOKEN = 4
  // Output tokens uchun 25% zaxira (modelning maxOutputTokens o'rniga)
  private static readonly OUTPUT_BUFFER_RATIO = 0.25

  /**
   * Matnning taxminiy token sonini hisoblaydi (rough estimate)
   * Groq modellari uchun 1 token ≈ 4 belgi
   */
  static estimateTokens(text: string): number {
    if (!text) return 0
    return Math.ceil(text.length / ChatService.CHARS_PER_TOKEN)
  }

  /**
   * AI messages massivini context window'ga moslab kesadi.
   * Eng eski history messagelardan boshlab tozalaydi,
   * system prompt va eng oxirgi user message saqlanadi.
   */
  private truncateMessagesToFit(
    messages: AIMessage[],
    contextWindow: number
  ): AIMessage[] {
    if (messages.length <= 2) return messages // system prompt + current message

    // Output buffer: context window'ning 25% i output uchun
    const maxInputTokens = Math.floor(contextWindow * (1 - ChatService.OUTPUT_BUFFER_RATIO))

    // Barcha message'larning token sonini hisoblaymiz
    const tokenCounts = messages.map(m => {
      const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      return ChatService.estimateTokens(text)
    })

    const totalTokens = tokenCounts.reduce((a, b) => a + b, 0)

    // Agar context window'ga sig'sa, truncate qilmaymiz
    if (totalTokens <= maxInputTokens) return messages

    // System prompt (index 0) va style prompt (index 1) saqlanadi
    // history messagelardan (index 2 va undan keyin) truncate qilamiz
    // Eng eski history messagelar birinchi o'chiriladi
    let runningTotal = 0
    const truncated: AIMessage[] = []

    for (let i = 0; i < messages.length; i++) {
      // System va style prompt har doim saqlanadi
      if (i <= 1) {
        truncated.push(messages[i])
        runningTotal += tokenCounts[i]
        continue
      }

      // Oxirgi user message (eng yangi) har doim saqlanadi
      if (i === messages.length - 1) {
        truncated.push(messages[i])
        runningTotal += tokenCounts[i]
        continue
      }

      // History messagelar — faqat sig'sa qo'shiladi
      if (runningTotal + tokenCounts[i] <= maxInputTokens) {
        truncated.push(messages[i])
        runningTotal += tokenCounts[i]
      }
      // Sig'masa — skip (eski history message tashlab yuboriladi)
    }

    return truncated
  }

  // ============================================================
  // 5. SYSTEM / STYLE PROMPT METODLARI
  // ============================================================

  private getSystemPrompt(language: string = 'uz'): string {
    if (language === 'ru') {
      return UzbekPromptBuilder.getRussianPrompt()
    }
    if (language === 'en') {
      return UzbekPromptBuilder.getEnglishPrompt()
    }
    return UzbekPromptBuilder.getSystemPrompt()
  }

  private getStylePrompt(isCodingIntent: boolean): string {
    return UzbekPromptBuilder.getStylePrompt(isCodingIntent)
  }

  // ============================================================
  // 5b. CODING-INTENT ANIQLASH
  // ============================================================

  private detectCodingIntent(text: string): boolean {
    const codingSignals = [
      /```/,
      /\b(function|const|let|var|class|import|export|async|await|interface|type)\b/i,
      /\b(bug|error|xato|xatolik|fix|debug|refactor)\b/i,
      /\b(api|endpoint|database|sql|query|schema|migration)\b/i,
      /\b(kod|dastur|funksiya|metod|klass|frontend|backend)\b/i,
      /\.(js|ts|tsx|jsx|py|go|rs|java|sql|json|yaml|yml)\b/i,
      /\b(react|next\.?js|vue|node\.?js|express|fastify|nestjs|django|fastapi|docker|kubernetes)\b/i,
    ]
    return codingSignals.some((pattern) => pattern.test(text))
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

      // ─── 3b. Detect coding intent (temperature/maxTokens/style uchun) ──
      const isCoding = this.detectCodingIntent(input.content)

      // ─── 3c. Detect image attachments ──────────────────────────
      const hasImages = !!(input.attachmentIds?.length)

      // ─── 4. Smart Model Routing ────────────────────────────────
      const userSettings = user.settings as any || {}
      let provider = (input.provider ?? userSettings.defaultProvider ?? 'groq') as AIProvider
      let model = input.model ?? userSettings.defaultModel ?? 'llama-3.3-70b-versatile'

      // User manual override bo'lmasa, smart routing ishlaydi
      if (!input.model && !userSettings.defaultModel) {
        const route = modelRouter.route(input.content, hasImages)
        provider = route.provider as AIProvider
        model = route.model
        this.app.log.info(`🤖 Smart route: ${route.model} (${route.reason})`)
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
        model = 'llama-3.3-70b-versatile'
        provider = 'groq' as AIProvider
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
        take: 20,
        include: { attachments: { include: { file: true } } },
      })

      // ─── 7. Build AI messages ────────────────────────────────────
      let aiMessages: AIMessage[] = []

      // System prompt (til bo'yicha, pro full-stack coder)
      aiMessages.push({
        role: 'system',
        content: this.getSystemPrompt(detectedLanguage),
      })

      // Style prompt (coding vs casual)
      aiMessages.push({
        role: 'system',
        content: this.getStylePrompt(isCoding),
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

      // ─── 7b. Truncate messages to fit context window ───────────
      try {
        const modelConfig = await this.prisma.aIModelConfig.findUnique({
          where: { modelId: model },
          select: { contextWindow: true },
        })
        const contextWindow = modelConfig?.contextWindow ?? 128000
        const beforeCount = aiMessages.length
        aiMessages = this.truncateMessagesToFit(aiMessages, contextWindow)
        if (aiMessages.length < beforeCount) {
          this.app.log.info(
            `📐 Truncated ${beforeCount - aiMessages.length} message(s) to fit ${contextWindow} context window`
          )
        }
      } catch (err) {
        // Truncation xatosi — ignore, davom etamiz
        this.app.log.warn({ err }, 'Truncation error (non-fatal)')
      }

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

      // Kayfiyat emojisini yuborish (faqat casual rejim uchun foydali)
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

      // 🧮 Math pre-calculation — AI ga yuborishdan oldin hisoblab qo'yamiz
      if (!hasImages) {
        const mathResult = calculateService.findAndEvaluate(input.content)
        if (mathResult?.result) {
          additionalContext += `\n\n[KALKULYATOR NATIJASI]\nIfoda: ${mathResult.expression}\nNatija: ${mathResult.result}\n(Eslatma: Foydalanuvchiga to'g'ri javobni ko'rsat, agar so'ralsa hisoblash bosqichlarini tushuntir.)`
          yield { type: 'delta', delta: '🧮 Hisoblanmoqda...\n\n' }
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

      // ─── 11. Check for image generation request ─────────────────
      const imagePattern = /^(rasm\s+chiz|rasim\s+chiz|rasm\s+yarat|chiz\s+menga|draw\s+|generate\s+image\s+|create\s+image\s+)/i
      const imageMatch = input.content.match(imagePattern)

      if (imageMatch && process.env.HF_API_KEY) {
        const prompt = input.content.replace(imagePattern, '').trim()
        yield { type: 'delta', delta: `🎨 **"${prompt}"** rasmi yaratilmoqda...\n\n` }

        try {
          const axios = (await import('axios')).default
          const encodedPrompt = encodeURIComponent(prompt)
          const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&nologo=true&enhance=true`

          await axios.head(imageUrl, { timeout: 15000 })

          const imgTag = `![${prompt}](${imageUrl})`
          const doneContent = `${imgTag}\n\n*Prompt: "${prompt}"*`

          await this.prisma.message.update({
            where: { id: assistantMessage.id },
            data: { content: doneContent, status: 'complete' },
          })
          yield { type: 'delta', delta: doneContent }
          yield { type: 'done', messageId: assistantMessage.id, finishReason: 'stop' }
          return
        } catch (err: any) {
          this.app.log.error({ err: err?.message }, 'Image generation failed')
          yield { type: 'delta', delta: `❌ Rasm yaratishda xato. Oddiy suhbat rejimiga o'tildi:\n\n` }
          yield { type: 'done', messageId: assistantMessage.id, finishReason: 'stop' }
          return
        }
      }

      // ─── 12. Stream from AI provider ────────────────────────────
      let fullContent = ''
      let inputTokens = 0
      let outputTokens = 0
      let finishReason = 'stop'
      const startTime = Date.now()

      // Coding so'rovlar uchun: barqarorroq (past temperature) va uzunroq javob limiti
      const temperature = isCoding ? 0.25 : 0.7
      const maxTokens = input.maxTokens || (isCoding ? 16384 : 8192)

      // ─── Key rotation: 429/rate-limit bo'lganda keyingi keyga o'tish ───
      const MAX_KEY_RETRIES = groqKeyManager.getStatus().total
      let keyRetry = 0
      let streamSuccess = false

      while (keyRetry <= MAX_KEY_RETRIES && !streamSuccess) {
        try {
          const stream = aiProvider.chatStream({
            model: model,
            provider,
            messages: aiMessages,
            temperature,
            maxTokens,
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

          streamSuccess = true

        } catch (err) {
          const error = err as Error

          // ─── So'rov juda katta (413) — contextni qisqartirib qayta urinish ───
          if (groqKeyManager.isRequestTooLargeError(error) && provider === 'groq') {
            keyRetry++
            this.app.log.warn(`📐 Groq request too large (attempt ${keyRetry}), truncating messages`)

            const modelConfig = await this.prisma.aIModelConfig.findUnique({
              where: { modelId: model },
              select: { contextWindow: true },
            }).catch(() => null)
            const contextWindow = modelConfig?.contextWindow ?? 128000

            const reducedWindow = Math.floor(contextWindow * 0.6)
            const beforeCount = aiMessages.length
            aiMessages = this.truncateMessagesToFit(aiMessages, reducedWindow)

            if (aiMessages.length < beforeCount) {
              this.app.log.info(`📐 Re-truncated to ${aiMessages.length} messages (${reducedWindow} window)`)
              fullContent = ''
              continue
            }

            const tooLargeMsg = detectedLanguage === 'uz'
              ? 'Xabar juda katta. Iltimos, matnni qisqartirib qayta yuboring. 😔'
              : detectedLanguage === 'ru'
              ? 'Сообщение слишком большое. Пожалуйста, сократите текст. 😔'
              : 'Message too large. Please shorten your text and try again. 😔'

            await this.prisma.message.update({
              where: { id: assistantMessage.id },
              data: { status: 'error', content: tooLargeMsg },
            })
            yield { type: 'error', error: tooLargeMsg }
            return
          }

          // ─── Vaqtinchalik token limiti (TPM/TPD) — temporary cool-down ───
          if (groqKeyManager.isTokenLimitError(error) && provider === 'groq') {
            keyRetry++
            const nextKey = groqKeyManager.markCurrentExhausted(error.message, { temporary: true })

            if (nextKey) {
              this.app.log.warn(`⏳ Groq TPM limit (attempt ${keyRetry}), switching key temporarily`)
              try {
                const groqProvider = this.ai.get('groq') as any
                if (groqProvider && typeof groqProvider.setApiKey === 'function') {
                  groqProvider.setApiKey(nextKey)
                }
              } catch { /* ignore */ }
              fullContent = ''
              continue
            }

            if (groqKeyManager.allExhausted()) {
              this.app.log.warn('⏳ All keys temporarily exhausted (TPM), waiting 1s...')
              await new Promise(r => setTimeout(r, 1000))
              groqKeyManager.getStatus()
              const retryKey = groqKeyManager.getCurrentKey()
              if (retryKey) {
                try {
                  const groqProvider = this.ai.get('groq') as any
                  if (groqProvider && typeof groqProvider.setApiKey === 'function') {
                    groqProvider.setApiKey(retryKey)
                  }
                } catch { /* ignore */ }
                fullContent = ''
                continue
              }
            }
          }

          // ─── 429 / rate-limit xatoligi — keyingi keyga o'tish (24h cooldown) ───
          if (groqKeyManager.isRateLimitError(error) && provider === 'groq') {
            keyRetry++
            const nextKey = groqKeyManager.markCurrentExhausted(error.message)

            if (nextKey) {
              this.app.log.warn(`🔄 Groq key rotated (attempt ${keyRetry}), trying next key`)
              // Groq provider da yangi key o'rnatish
              try {
                const groqProvider = this.ai.get('groq') as any
                if (groqProvider && typeof groqProvider.setApiKey === 'function') {
                  groqProvider.setApiKey(nextKey)
                }
              } catch {
                // ignore
              }
              fullContent = ''
              continue
            }

            if (groqKeyManager.allExhausted()) {
              const exhaustedMsg = detectedLanguage === 'uz'
                ? 'Limitingiz tugadi. Iltimos, bir oz kuting yoki keyinroq urinib ko\'ring. 😔'
                : detectedLanguage === 'ru'
                ? 'Лимит исчерпан. Пожалуйста, подождите и попробуйте позже. 😔'
                : 'All limits exhausted. Please wait and try again later. 😔'

              await this.prisma.message.update({
                where: { id: assistantMessage.id },
                data: { status: 'error', content: exhaustedMsg },
              })
              yield { type: 'error', error: exhaustedMsg }
              return
            }
          }

          this.app.log.error(error, 'AI stream error')

          let errorMessage = `Kechirasiz, xatolik yuz berdi. Qaytadan urinib ko'ring. 😔`
          if (detectedLanguage === 'en') {
            errorMessage = `Sorry, an error occurred. Please try again. 😔`
          } else if (detectedLanguage === 'ru') {
            errorMessage = `Извините, произошла ошибка. Попробуйте ещё раз. 😔`
          }

          fullContent = errorMessage

          await this.prisma.message.update({
            where: { id: assistantMessage.id },
            data: { status: 'error', content: errorMessage },
          })

          yield { type: 'error', error: error.message }
          return
        }
      }

      const latencyMs = Date.now() - startTime

      // ─── 12b. O'ZBEK TILI UCHUN TOZALASH ──────────────────────
      // Faqat coding bo'lmagan xabarlarda ishlaydi — kod javoblari
      // hech qachon o'zgartirilmaydi, chunki bu kodni buzishi mumkin
      if (!isCoding && detectedLanguage === 'uz') {
        fullContent = this.uzbekFilter.clean(fullContent)
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

  getEmojiManager(): EmojiMoodManager {
    return this.emojiManager
  }
}

export default ChatService