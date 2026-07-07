import type { FastifyInstance } from 'fastify'
import { calculateService } from '../services/calculate.service'

export default async function calculatorRoutes(app: FastifyInstance) {
  // POST /api/v1/chat/calculate — matematik ifodani hisoblash
  app.post('/calculate', async (request, reply) => {
    const { expression } = request.body as { expression: string }

    if (!expression || typeof expression !== 'string') {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Expression is required' },
      })
    }

    const result = calculateService.evaluate(expression)

    if (result.error) {
      return reply.status(422).send({
        success: false,
        error: { code: 'CALCULATION_ERROR', message: result.error },
      })
    }

    return reply.send({
      success: true,
      data: {
        expression: result.expression,
        result: result.result,
      },
    })
  })
}
