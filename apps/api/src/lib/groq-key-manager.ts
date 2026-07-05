/**
 * Groq API Key Rotation Manager
 * Bir key 429 (rate limit) yoki TPD/TPM limitga yetganda
 * avtomatik keyingi keyga o'tadi.
 */

import { config } from '../config'
import { logger } from './logger'

interface KeyState {
  key: string
  exhausted: boolean
  exhaustedAt: number | null
  failCount: number
}

class GroqKeyManager {
  private keys: KeyState[] = []
  private currentIndex = 0
  // Kunlik reset: 24 soat (ms)
  private readonly DAILY_RESET_MS = 24 * 60 * 60 * 1000

  constructor() {
    this.loadKeys()
  }

  private loadKeys() {
    const rawKeys = [
      config.GROQ_API_KEY,
      config.GROQ_API_KEY_2,
      config.GROQ_API_KEY_3,
      config.GROQ_API_KEY_4,
      config.GROQ_API_KEY_5,
      config.GROQ_API_KEY_6,
    ].filter((k): k is string => !!k && k.trim().length > 0)

    this.keys = rawKeys.map((key) => ({
      key,
      exhausted: false,
      exhaustedAt: null,
      failCount: 0,
    }))

    logger.info(`🔑 Groq key rotation: ${this.keys.length} key(s) loaded`)
  }

  /** Faol keyni olish */
  getCurrentKey(): string | null {
    this.resetExpiredKeys()

    // Hozirgi key ishlasa, uni ber
    const current = this.keys[this.currentIndex]
    if (current && !current.exhausted) {
      return current.key
    }

    // Keyingi ishlaydigan keyni top
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length
      if (!this.keys[idx].exhausted) {
        this.currentIndex = idx
        return this.keys[idx].key
      }
    }

    return null // Hammasi tugagan
  }

  /** 429 yoki rate limit xatoligida keyni exhausted deb belgilash va keyingiga o'tish */
  markCurrentExhausted(errorMessage?: string): string | null {
    if (this.keys.length === 0) return null

    const current = this.keys[this.currentIndex]
    if (current) {
      current.exhausted = true
      current.exhaustedAt = Date.now()
      current.failCount += 1
      logger.warn(
        `⚠️  Groq key #${this.currentIndex + 1} exhausted. Error: ${errorMessage ?? 'rate limit'}`
      )
    }

    // Keyingi aktiv keyni top
    for (let i = 1; i <= this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length
      if (!this.keys[idx].exhausted) {
        this.currentIndex = idx
        logger.info(`🔄 Switched to Groq key #${this.currentIndex + 1}`)
        return this.keys[idx].key
      }
    }

    logger.error('❌ All Groq API keys exhausted!')
    return null
  }

  /** 24 soat o'tgan keylarni qayta aktivlashtirish */
  private resetExpiredKeys() {
    const now = Date.now()
    for (const state of this.keys) {
      if (state.exhausted && state.exhaustedAt) {
        if (now - state.exhaustedAt >= this.DAILY_RESET_MS) {
          state.exhausted = false
          state.exhaustedAt = null
          logger.info('🔁 Groq key reset after 24h')
        }
      }
    }
  }

  /** Xato rate limit xatosimi tekshirish */
  isRateLimitError(error: any): boolean {
    const msg: string = error?.message ?? error?.toString() ?? ''
    const status = error?.status ?? error?.response?.status ?? 0
    return (
      status === 429 ||
      status === 413 ||
      msg.includes('429') ||
      msg.includes('413') ||
      msg.includes('rate limit') ||
      msg.includes('Rate limit') ||
      msg.includes('Request too large') ||
      msg.includes('tokens per day') ||
      msg.includes('tokens per minute') ||
      msg.includes('TPD') ||
      msg.includes('TPM')
    )
  }

  /** Nechta key bor va nechta aktiv */
  getStatus() {
    this.resetExpiredKeys()
    const total = this.keys.length
    const active = this.keys.filter((k) => !k.exhausted).length
    return { total, active, exhausted: total - active }
  }

  /** Hamma key tugaganmi */
  allExhausted(): boolean {
    this.resetExpiredKeys()
    return this.keys.every((k) => k.exhausted)
  }
}

// Singleton
export const groqKeyManager = new GroqKeyManager()
