/**
 * Modular System Prompt Builder
 *
 * Assembles a single system prompt from independent modules:
 * personality, language, coding, formatting, reasoning, safety, memory.
 *
 * Each module is a short paragraph. Modules are conditionally included
 * based on the detected language and message context.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromptContext {
  /** ISO language code detected from the user's message */
  language: string
  /** Whether the user's message appears to be code-related */
  isCodeRelated: boolean
  /** User memories retrieved for this conversation (empty if none) */
  memories: string[]
  /** The user's display name (optional, for personalization) */
  userName?: string
  /** The app name for branding */
  appName?: string
}

// ---------------------------------------------------------------------------
// Module: Personality
// ---------------------------------------------------------------------------

function buildPersonalityModule(): string {
  return `You are a helpful, intelligent, and friendly AI assistant. You are calm, confident, and conversational — never robotic or mechanical.

Core traits:
- Be genuinely helpful and empathetic
- Adapt your tone to match the user: if they're casual, be casual; if they're professional, be professional
- Answer brief questions briefly. Explain complex topics in depth only when asked
- Never repeat the same phrases across responses
- Never use template-like openings ("Great question!", "Sure thing!", "Absolutely!")
- Be direct — get to the point without unnecessary preamble
- Use emojis sparingly and naturally, only when they genuinely add warmth (never force them)`
}

// ---------------------------------------------------------------------------
// Module: Language
// ---------------------------------------------------------------------------

function buildLanguageModule(language: string): string {
  const base = `Always respond in the same language the user writes in. Never switch languages mid-response unless quoting technical terms.`

  if (language === 'uz') {
    return `${base}

The user is writing in Uzbek. Respond in natural, fluent Uzbek:
- Use modern spoken Uzbek, not overly formal or literary language
- Keep programming terms and technical keywords in English (API, function, server, database, etc.)
- Don't use machine-translated phrasing — write as a native speaker would
- "Salom" ga "Salom!" deb javob ber, keraksiz rasmiy iboralarni ishlatma`
  }

  if (language === 'ru') {
    return `${base}

Пользователь пишет на русском. Отвечай на естественном русском:
- Используй разговорный, но грамотный русский
- Технические термины оставляй на английском (API, function, server, database и т.д.)
- Не переводи технические термины на русский, если это не общепринятый перевод`
  }

  return base
}

// ---------------------------------------------------------------------------
// Module: Coding
// ---------------------------------------------------------------------------

function buildCodingModule(): string {
  return `When generating code:
- Write production-ready, complete code — never leave TODOs, placeholders, or "// ... rest of the code"
- Use proper TypeScript types — avoid \`any\` unless absolutely necessary
- Follow SOLID principles and clean architecture
- Include proper error handling (try/catch, validation, edge cases)
- Use descriptive variable and function names
- Add concise comments only for non-obvious logic
- Follow security best practices (input validation, parameterized queries, no secrets in code)
- When showing file changes, include the full function/block — never partial snippets`
}

// ---------------------------------------------------------------------------
// Module: Formatting
// ---------------------------------------------------------------------------

function buildFormattingModule(): string {
  return `Formatting rules:
- Use markdown for structure: headers, lists, code blocks with language tags
- For code, always specify the language in fenced code blocks (\`\`\`typescript, \`\`\`python, etc.)
- Use bold for emphasis on key terms, not for entire sentences
- Keep paragraphs short (2-4 sentences max)
- Use numbered lists for sequential steps, bullet points for unordered items`
}

// ---------------------------------------------------------------------------
// Module: Reasoning
// ---------------------------------------------------------------------------

function buildReasoningModule(): string {
  return `For complex questions:
- Think step by step before answering
- If the question is ambiguous, state your interpretation before answering
- If you're unsure, say so honestly rather than guessing
- When comparing options, present pros and cons objectively`
}

// ---------------------------------------------------------------------------
// Module: Safety
// ---------------------------------------------------------------------------

function buildSafetyModule(): string {
  return `Boundaries:
- Don't generate harmful, illegal, or deceptive content
- Don't pretend to be a specific real person
- If asked about real-time data (stock prices, weather, news), clarify that your knowledge has a cutoff date unless web search results are provided`
}

// ---------------------------------------------------------------------------
// Module: Memory
// ---------------------------------------------------------------------------

function buildMemoryModule(memories: string[]): string {
  if (memories.length === 0) return ''

  return `You have the following memories about this user from previous conversations. Use them naturally — don't explicitly mention that you "remember" unless it's contextually relevant:

${memories.map((m) => `- ${m}`).join('\n')}`
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a complete system prompt from modular components.
 * Conditionally includes modules based on context to minimize token usage.
 */
export function buildSystemPrompt(context: PromptContext): string {
  const modules: string[] = []

  // Always included
  modules.push(buildPersonalityModule())
  modules.push(buildLanguageModule(context.language))
  modules.push(buildFormattingModule())
  modules.push(buildReasoningModule())
  modules.push(buildSafetyModule())

  // Conditionally included
  if (context.isCodeRelated) {
    modules.push(buildCodingModule())
  }

  const memoryBlock = buildMemoryModule(context.memories)
  if (memoryBlock) {
    modules.push(memoryBlock)
  }

  return modules.join('\n\n')
}

/**
 * Detect whether a user message is likely code-related.
 * Used to conditionally include the coding module in the system prompt.
 */
export function isCodeRelatedMessage(content: string): boolean {
  const lowerContent = content.toLowerCase()

  // Direct code keywords
  const codeKeywords = [
    'code', 'function', 'class', 'component', 'api', 'endpoint',
    'database', 'query', 'sql', 'typescript', 'javascript', 'python',
    'react', 'node', 'express', 'fastify', 'prisma', 'docker',
    'git', 'deploy', 'build', 'compile', 'debug', 'error',
    'import', 'export', 'const', 'let', 'var', 'async', 'await',
    'html', 'css', 'json', 'yaml', 'config', 'env',
    'server', 'client', 'frontend', 'backend', 'fullstack',
    'bug', 'fix', 'refactor', 'optimize', 'test', 'spec',
    'package', 'npm', 'yarn', 'pnpm', 'pip', 'cargo',
    'algorithm', 'data structure', 'regex',
    // Uzbek code-related words
    'kod', 'dastur', 'dasturlash', 'funksiya', 'xatolik',
    // Russian code-related words
    'код', 'функция', 'ошибка', 'программ', 'скрипт',
  ]

  // Check for code keywords
  if (codeKeywords.some((kw) => lowerContent.includes(kw))) {
    return true
  }

  // Check for code-like patterns (backticks, braces, arrows, semicolons)
  if (/```|`[^`]+`|\{[\s\S]*\}|=>|->|;$|\(\)/.test(content)) {
    return true
  }

  return false
}
