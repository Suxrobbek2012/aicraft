import type { FastifyInstance } from 'fastify'

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

    try {
      // Pollinations.ai — bepul, API key shart emas
      const encodedPrompt = encodeURIComponent(prompt.trim())
      const seed = Math.floor(Math.random() * 1000000)
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&enhance=true`

      return reply.send({
        success: true,
        data: {
          url: imageUrl,
          prompt,
          model: 'pollinations-flux',
        },
      })
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: { code: 'IMAGE_GEN_FAILED', message: 'Image generation failed. Please try again.' },
      })
    }
  })
}
