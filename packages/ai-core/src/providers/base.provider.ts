import type {
  AIRequestOptions,
  AIResponse,
  AIStreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  AIProvider,
} from '@go-ai/shared'

export abstract class BaseAIProvider {
  abstract readonly provider: AIProvider
  abstract readonly name: string

  abstract isAvailable(): Promise<boolean>

  abstract chat(options: AIRequestOptions): Promise<AIResponse>

  abstract chatStream(
    options: AIRequestOptions
  ): AsyncGenerator<AIStreamChunk, void, unknown>

  abstract embed(request: EmbeddingRequest): Promise<EmbeddingResponse>

  abstract listModels(): Promise<string[]>

  protected buildError(message: string, code?: string): Error {
    const err = new Error(message) as Error & { code?: string; provider?: AIProvider }
    err.code = code ?? 'PROVIDER_ERROR'
    err.provider = this.provider
    return err
  }

  protected measureLatency<T>(fn: () => Promise<T>): Promise<[T, number]> {
    const start = Date.now()
    return fn().then((result) => [result, Date.now() - start])
  }
}
