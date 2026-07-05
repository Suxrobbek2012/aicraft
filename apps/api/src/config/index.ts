import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3010),
  HOST: z.string().default('0.0.0.0'),
  APP_NAME: z.string().default('aicraft'),

APP_URL: z.string().url().default('http://localhost:3011'),

API_URL: z.string().url().default('http://localhost:3010'),

CORS_ORIGINS: z.string().default('http://localhost:3011'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: z.string().optional(),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('30d'),

  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 chars'),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_ORG_ID: z.string().optional(),
  OPENAI_DEFAULT_MODEL: z.string().default('gpt-4o'),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_DEFAULT_MODEL: z.string().default('claude-3-5-sonnet-20241022'),

  GOOGLE_API_KEY: z.string().optional(),
  GOOGLE_DEFAULT_MODEL: z.string().default('gemini-1.5-pro'),

  XAI_API_KEY: z.string().optional(),
  XAI_DEFAULT_MODEL: z.string().default('grok-2'),

  PERPLEXITY_API_KEY: z.string().optional(),
  PERPLEXITY_DEFAULT_MODEL: z.string().default('llama-3.1-sonar-large-128k-online'),

  GROQ_API_KEY: z.string().optional(),
  GROQ_API_KEY_2: z.string().optional(),
  GROQ_API_KEY_3: z.string().optional(),
  GROQ_API_KEY_4: z.string().optional(),
  GROQ_API_KEY_5: z.string().optional(),
  GROQ_API_KEY_6: z.string().optional(),
  GROQ_DEFAULT_MODEL: z.string().default('llama-3.3-70b-versatile'),

  HF_API_KEY: z.string().optional(),

  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  OLLAMA_DEFAULT_MODEL: z.string().default('llama3.2:1b'),
  // OLLAMA_DEFAULT_MODEL: z.string().default('llama3.2:3b'),

  STORAGE_PROVIDER: z.enum(['local', 's3', 'r2']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(50),

  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_BUCKET: z.string().optional(),

  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['smtp', 'sendgrid', 'resend']).default('smtp'),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('aicraft <noreply@aicraft.app>'),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_FREE_PRICE_ID: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_ULTRA_PRICE_ID: z.string().optional(),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),

  SENTRY_DSN: z.string().optional(),


  ADMIN_EMAIL: z.string().email().default('admin@goai.app'),

  ADMIN_PASSWORD: z.string().default('Admin123!'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = parsed.data

export type Config = typeof config
