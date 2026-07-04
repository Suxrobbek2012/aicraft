import { PrismaClient, UserRole, UserStatus, SubscriptionPlan, SubscriptionStatus } from '../generated/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── AI Models ──────────────────────────────────────────────────────────────
  const models = [
    // OpenAI
    {
      modelId: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      inputPricePerMillion: 5.0,
      outputPricePerMillion: 15.0,
      isEnabled: true,
      isDefault: true,
      capabilities: ['chat', 'vision', 'tools', 'code', 'reasoning'],
      description: 'Most capable GPT-4 model, great for complex tasks',
      order: 1,
    },
    {
      modelId: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      inputPricePerMillion: 0.15,
      outputPricePerMillion: 0.6,
      isEnabled: true,
      isDefault: false,
      capabilities: ['chat', 'vision', 'tools', 'code'],
      description: 'Fast and efficient for everyday tasks',
      order: 2,
    },
    {
      modelId: 'o1',
      name: 'o1',
      provider: 'openai',
      contextWindow: 200000,
      maxOutputTokens: 100000,
      supportsVision: false,
      supportsTools: false,
      supportsStreaming: true,
      inputPricePerMillion: 15.0,
      outputPricePerMillion: 60.0,
      isEnabled: true,
      isDefault: false,
      capabilities: ['chat', 'code', 'reasoning'],
      description: 'Advanced reasoning model for complex problems',
      order: 3,
    },
    // Anthropic
    {
      modelId: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      inputPricePerMillion: 3.0,
      outputPricePerMillion: 15.0,
      isEnabled: true,
      isDefault: false,
      capabilities: ['chat', 'vision', 'tools', 'code', 'reasoning'],
      description: 'Anthropic\'s most intelligent model',
      order: 10,
    },
    {
      modelId: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      inputPricePerMillion: 0.25,
      outputPricePerMillion: 1.25,
      isEnabled: true,
      isDefault: false,
      capabilities: ['chat', 'vision', 'tools', 'code'],
      description: 'Fast and compact Claude model',
      order: 11,
    },
    // Google
    {
      modelId: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      provider: 'google',
      contextWindow: 2000000,
      maxOutputTokens: 8192,
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      inputPricePerMillion: 3.5,
      outputPricePerMillion: 10.5,
      isEnabled: true,
      isDefault: false,
      capabilities: ['chat', 'vision', 'tools', 'code', 'reasoning'],
      description: 'Google\'s most capable model with 2M context',
      order: 20,
    },
    {
      modelId: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      provider: 'google',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
      supportsVision: true,
      supportsTools: true,
      supportsStreaming: true,
      inputPricePerMillion: 0.075,
      outputPricePerMillion: 0.3,
      isEnabled: true,
      isDefault: false,
      capabilities: ['chat', 'vision', 'tools', 'code'],
      description: 'Fast multimodal model from Google',
      order: 21,
    },
    // xAI
    {
      modelId: 'grok-2',
      name: 'Grok 2',
      provider: 'xai',
      contextWindow: 131072,
      maxOutputTokens: 131072,
      supportsVision: false,
      supportsTools: true,
      supportsStreaming: true,
      inputPricePerMillion: 2.0,
      outputPricePerMillion: 10.0,
      isEnabled: true,
      isDefault: false,
      capabilities: ['chat', 'tools', 'code', 'reasoning'],
      description: 'xAI\'s powerful reasoning model',
      order: 30,
    },
    // Perplexity
    {
      modelId: 'llama-3.1-sonar-large-128k-online',
      name: 'Sonar Large (Online)',
      provider: 'perplexity',
      contextWindow: 127072,
      maxOutputTokens: 8192,
      supportsVision: false,
      supportsTools: false,
      supportsStreaming: true,
      inputPricePerMillion: 1.0,
      outputPricePerMillion: 1.0,
      isEnabled: true,
      isDefault: false,
      capabilities: ['chat', 'search'],
      description: 'Real-time web search powered model',
      order: 40,
    },
    // Local aicraft
    {
      modelId: 'ollama/llama3.2',
      name: 'aicraftX',
      provider: 'ollama',
      contextWindow: 131072,
      maxOutputTokens: 8192,
      supportsVision: false,
      supportsTools: false,
      supportsStreaming: true,
      inputPricePerMillion: 0,
      outputPricePerMillion: 0,
      isEnabled: true,
      isDefault: false,
      capabilities: ['chat', 'code'],
      description: 'Run locally with aicraft — free, private',
      order: 50,
    },
  ]

  for (const model of models) {
    await prisma.aIModelConfig.upsert({
      where: { modelId: model.modelId },
      update: model,
      create: model,
    })
  }
  console.log(`✅ Seeded ${models.length} AI models`)

  // ─── Admin User ──────────────────────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@goai.app'
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'Admin123!'
  const passwordHash = await bcrypt.hash(adminPassword, 12)

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      username: 'admin',
      displayName: 'Admin',
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      plan: SubscriptionPlan.ULTRA,
      isEmailVerified: true,
      tokenBalance: 999999999,
      settings: {
        create: {
          theme: 'dark',
          language: 'en',
          defaultModel: 'gpt-4o',
          defaultProvider: 'openai',
          memoryEnabled: true,
        },
      },
      subscription: {
        create: {
          plan: SubscriptionPlan.ULTRA,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      },
    },
  })
  console.log(`✅ Admin user: ${admin.email}`)

  // ─── System Config ────────────────────────────────────────────────────────────
  const configs = [
    { key: 'app.name', value: 'aicraft', group: 'general', isPublic: true },
    { key: 'app.maintenance', value: 'false', type: 'boolean', group: 'general', isPublic: true },
    { key: 'app.registration_enabled', value: 'true', type: 'boolean', group: 'general', isPublic: true },
    { key: 'app.max_upload_mb', value: '50', type: 'number', group: 'general', isPublic: true },
    { key: 'app.free_daily_messages', value: '20', type: 'number', group: 'limits', isPublic: false },
    { key: 'app.pro_daily_messages', value: '200', type: 'number', group: 'limits', isPublic: false },
    { key: 'app.default_model', value: 'gpt-4o', group: 'ai', isPublic: true },
    { key: 'app.default_provider', value: 'openai', group: 'ai', isPublic: true },
  ]

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: {
        ...config,
        type: config.type ?? 'string',
        isPublic: config.isPublic ?? false,
      },
    })
  }
  console.log(`✅ Seeded ${configs.length} system configs`)

  console.log('✅ Database seeded successfully')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
