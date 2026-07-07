/**
 * Aicraft Model Router — Smart model selection
 *
 * Har xil turdagi so'rovlar uchun eng optimal modelni tanlaydi.
 * Barcha modellar Groq orqali bepul.
 *
 * Model map:
 * - deepseek-r1-distill-llama-70b → kod, reasoning, complex tasks
 * - llama-3.2-90b-vision-preview → rasm tahlili (vision)
 * - qwen-2.5-32b → kod, umumiy tasks (alternativ)
 * - llama-3.3-70b-versatile → oddiy suhbat, default
 */

export interface ModelRoute {
  provider: string
  model: string
  reason: string
}

export type IntentType = 'coding' | 'math' | 'vision' | 'general' | 'reasoning'

class ModelRouter {
  /**
   * So'rov intentini aniqlaydi
   */
  detectIntent(text: string, hasImages: boolean): IntentType {
    // Vision — rasm bor
    if (hasImages) return 'vision'

    // Math — matematik ifoda
    if (this.isMathQuery(text)) return 'math'

    // Coding — kod yozish so'rovi
    if (this.isCodingQuery(text)) return 'coding'

    // Deep reasoning — analytical questions
    if (this.isReasoningQuery(text)) return 'reasoning'

    return 'general'
  }

  /**
   * Intentga mos model va providerni qaytaradi
   */
  route(text: string, hasImages: boolean): ModelRoute {
    const intent = this.detectIntent(text, hasImages)

    switch (intent) {
      case 'vision':
        return {
          provider: 'groq',
          model: 'llama-3.2-90b-vision-preview',
          reason: 'Vision model for image analysis',
        }

      case 'coding':
        return {
          provider: 'groq',
          model: 'deepseek-r1-distill-llama-70b',
          reason: 'Best for code generation and debugging',
        }

      case 'math':
        return {
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          reason: 'Good for math with calculator tool',
        }

      case 'reasoning':
        return {
          provider: 'groq',
          model: 'deepseek-r1-distill-llama-70b',
          reason: 'Best for deep reasoning and analysis',
        }

      case 'general':
      default:
        return {
          provider: 'groq',
          model: 'llama-3.3-70b-versatile',
          reason: 'Fast general purpose model',
        }
    }
  }

  /**
   * Tool/function calling configuration
   */
  getTools(intent: IntentType) {
    const tools: any[] = []

    // Math tool — har doim qo'shiladi, AI kerak bo'lganda chaqiradi
    tools.push({
      type: 'function',
      function: {
        name: 'calculate',
        description: 'Matematik ifodani hisoblaydi. Masalan: 2+2, 5! + 3^2, sqrt(144), sin(45 deg)',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Matematik ifoda (masalan: 210213+31213*121/34)',
            },
          },
          required: ['expression'],
        },
      },
    })

    return tools
  }

  /**
   * Tool calling natijasini system promptga qo'shish
   */
  formatToolResult(toolName: string, result: any): string {
    switch (toolName) {
      case 'calculate':
        if (result.error) {
          return `[Calculator xatolik: ${result.error}]`
        }
        return `[Hisoblandi: ${result.expression} = ${result.result}]`
      default:
        return JSON.stringify(result)
    }
  }

  // ─── Private helpers ──────────────────────────────────────────

  private isMathQuery(text: string): boolean {
    const mathPatterns = [
      /^[\d\s+\-*/().,%^]{3,}$/,                    // faqat raqam va operatorlar
      /(?:hisobla|calculate|necha|qancha|hisoblab|top)\b/i,
      /[\d\s]+\+[\d\s]+/,                             // raqam + raqam
      /[\d\s]+[-*/%][\d\s]+/,                         // arifmetik amallar
      /[\d\s]+:+[\d\s]+/,                             // : (bo'lish)
      /[!\^]/,                                        // faktorial, daraja
      /\bsin\b|\bcos\b|\btan\b|\blog\b|\bsqrt\b/i,   // trigonometriya
      /\bpi\b|\be\b/i,                                 // konstantalar
      /=\s*\?/,                                        // = ?
    ]
    return mathPatterns.some(p => p.test(text))
  }

  private isCodingQuery(text: string): boolean {
    const codingPatterns = [
      /```/,
      /\b(function|const|let|var|class|import|export|async|await|interface|type)\b/i,
      /\b(bug|error|xato|xatolik|fix|debug|refactor|kompil|compile)\b/i,
      /\b(api|endpoint|database|sql|query|schema|migration|rest)\b/i,
      /\b(kod|code|dastur|program|funksiya|function|metod|method|klass|class)\b/i,
      /\.(js|ts|tsx|jsx|py|go|rs|java|sql|json|yaml|yml|css|html)\b/i,
      /\b(react|next\.?js|vue|node\.?js|express|fastify|nestjs|django|fastapi)\b/i,
      /\b(docker|kubernetes|k8s|ci\/cd|deploy|git)\b/i,
      /\b(algorithm|complexity|O\(|timeout|race condition|concurrent)\b/i,
    ]
    return codingPatterns.some(p => p.test(text))
  }

  private isReasoningQuery(text: string): boolean {
    const reasoningPatterns = [
      /\b(nima uchun|why|explain|tushuntir|sabab|reason|analyze|analysis)\b/i,
      /\b(taqqosla|compare|contrast|difference|farq|o'xshash|similar)\b/i,
      /\b(strategiya|strategy|plan|reja|roadmap)\b/i,
      /^.+\?$/,                                        // savol bilan tugasa
      /\b(argument|debate|pros and cons|afzallik|kamchilik)\b/i,
    ]
    return reasoningPatterns.some(p => p.test(text))
  }
}

export const modelRouter = new ModelRouter()
