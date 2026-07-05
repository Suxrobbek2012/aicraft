import type { FastifyInstance } from 'fastify'
import type { JwtPayload } from '../plugins/auth.plugin'
import { config } from '../config'

export default async function imageRoutes(app: FastifyInstance) {
  // POST /api/v1/images/generate
  app.post('/generate', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { prompt } = request.body as { prompt: string }

    if (!prompt || prompt.trim().length < 2) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Prompt is required' },
      })
    }

    if (!config.HF_API_KEY) {
      return reply.status(503).send({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Image generation is not configured' },
      })
    }

    // Use Stable Diffusion XL via HuggingFace Inference API
    const model = 'stabilityai/stable-diffusion-xl-base-1.0'
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.HF_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'image/png',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            negative_prompt: 'blurry, low quality, distorted, ugly',
            num_inference_steps: 25,
            guidance_scale: 7.5,
            width: 1024,
            height: 1024,
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text().catch(() => '')
      // Model loading — retry
      if (response.status === 503 || err.includes('loading')) {
        return reply.status(503).send({
          success: false,
          error: { code: 'MODEL_LOADING', message: 'Model is loading, please try again in 20 seconds' },
        })
      }
      return reply.status(500).send({
        success: false,
        error: { code: 'IMAGE_GEN_FAILED', message: 'Image generation failed' },
      })
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer())
    const base64 = imageBuffer.toString('base64')
    const dataUrl = `data:image/png;base64,${base64}`

    return reply.send({
      success: true,
      data: {
        url: dataUrl,
        prompt,
        model,
      },
    })
  })
}
