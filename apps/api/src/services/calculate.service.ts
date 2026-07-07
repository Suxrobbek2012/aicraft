/**
 * Math Calculator Service
 * Xavfsiz matematik ifodalarni hisoblaydi (eval() ishlatilmaydi)
 * mathjs library orqali safe evaluate
 */

import { create, all } from 'mathjs'

const math = create(all, {})

// Ruxsat berilgan funksiyalar
const ALLOWED_FUNCTIONS = new Set([
  'abs', 'add', 'ceil', 'divide', 'exp', 'floor', 'log', 'log10',
  'log2', 'max', 'min', 'mod', 'multiply', 'pow', 'round',
  'sqrt', 'subtract', 'unaryMinus', 'unaryPlus',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'sinh', 'cosh', 'tanh',
  'PI', 'E', 'i', 'pi', 'e',
  'factorial', 'permutations', 'combinations',
  'gcd', 'lcm', 'norm', 'dot', 'cross',
  'sum', 'mean', 'median', 'std', 'variance',
  'format', 'round', 'fix',
])

export interface CalculateResult {
  expression: string
  result: string
  error?: string
}

export class CalculateService {
  /**
   * Matematik ifodani xavfsiz hisoblash
   */
  evaluate(expression: string): CalculateResult {
    try {
      // Tozalash: faqat matematik belgilar qoldiriladi
      const cleaned = expression
        .replace(/\s/g, '')                 // bo'sh joylarni olib tashlash
        .replace(/×/g, '*')                 // × -> *
        .replace(/÷/g, '/')                 // ÷ -> /
        .replace(/:/g, '/')                 // : -> / (bo'lish)
        .replace(/−/g, '-')                 // minus belgisini normalize
        .replace(/,/g, '')                  // vergullarni olib tashlash (minglik)
        .replace(/≈/g, '=')                 // ≈ -> =
        .replace(/π/g, 'pi')                // π -> pi
        .replace(/∞/g, 'Infinity')          // cheksizlik

      if (!cleaned || cleaned.length > 500) {
        return {
          expression,
          result: '',
          error: 'Ifoda juda uzun yoki bo\'sh',
        }
      }

      // Faqat xavfsiz belgilar borligini tekshirish
      const safePattern = /^[\d+\-*/().,%^e \tpiE]+$/i
      const hasFunctions = /[a-zA-Z]/.test(cleaned) && !/^[\d+\-*/().,%^e \tpiE]+$/i.test(cleaned)

      if (!hasFunctions && !safePattern.test(cleaned)) {
        return {
          expression,
          result: '',
          error: 'Noto\'g\'ri ifoda',
        }
      }

      // mathjs orqali evaluate
      const node = math.parse(cleaned)
      const result = node.evaluate()

      // NaN yoki Infinity check
      if (result === undefined || result === null || (typeof result === 'number' && !isFinite(result))) {
        return {
          expression,
          result: '',
          error: 'Hisoblash xatoligi (cheksizlik yoki aniqlanmagan qiymat)',
        }
      }

      // Natijani formatlash
      let formattedResult: string
      if (typeof result === 'number') {
        if (Number.isInteger(result)) {
          formattedResult = result.toString()
        } else {
          formattedResult = math.format(result, { precision: 14 })
        }
      } else if (typeof result === 'bigint') {
        formattedResult = result.toString()
      } else if (typeof result === 'object' && result?.toString) {
        formattedResult = result.toString()
      } else {
        formattedResult = String(result)
      }

      return {
        expression,
        result: formattedResult,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Hisoblash xatoligi'
      return {
        expression,
        result: '',
        error: message,
      }
    }
  }

  /**
   * Matn ichidan matematik ifodani topib hisoblash
   * "210213+31213*121/34 = ?" yoki "hisobla 5! + 3^2" kabi so'rovlar uchun
   */
  findAndEvaluate(text: string): CalculateResult | null {
    // Pattern: raqamlar va operatorlar ketma-ketligi
    const patterns = [
      // "= ?" bilan tugaydigan ifodalar
      /([\d\s+\-*/().,%^]+)\s*=\s*\?\s*$/,
      // "necha", "hisobla" so'zlari bilan
      /(?:hisobla|calculate|necha|qancha|hisoblab|top)\s+([\d\s+\-*/().,%^]+)/i,
      // toza matematik ifodalar (faqat raqam va operator)
      /^([\d+\-*/().,%^]+)$/,
      // ko'p bosqichli ifodalar
      /([\d\s+\-*/().,%^]{3,})/,
    ]

    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match) {
        const expr = match[1].trim()
        if (expr.length >= 2 && expr.length <= 200) {
          const result = this.evaluate(expr)
          if (result.result) {
            return result
          }
        }
      }
    }

    return null
  }
}

export const calculateService = new CalculateService()
