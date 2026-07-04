import type { FastifyInstance } from 'fastify'
import { config } from '../config'
import { NotFoundError, ValidationError } from '../lib/errors'
import type { JwtPayload } from '../plugins/auth.plugin'

export default async function subscriptionRoutes(app: FastifyInstance) {
  // GET /api/v1/subscriptions/plans
  app.get('/plans', async (_request, reply) => {
    return reply.send({
      success: true,
      data: [
        {
          id: 'FREE',
          name: 'Free',
          price: 0,
          currency: 'USD',
          interval: 'month',
          features: [
            '20 messages/day',
            'GPT-4o Mini, Gemini Flash',
            '5MB file uploads',
            '50 conversations',
            'aicraft local models',
          ],
          limits: { dailyMessages: 20, monthlyTokens: 500000, maxFileSizeMb: 5 },
        },
        {
          id: 'PRO',
          name: 'Pro',
          price: 20,
          currency: 'USD',
          interval: 'month',
          stripePriceId: config.STRIPE_PRO_PRICE_ID,
          features: [
            '200 messages/day',
            'All models including GPT-4o, Claude 3.5',
            'Vision & image analysis',
            '25MB file uploads',
            'Voice input & TTS',
            'Long-term memory',
            'API access',
            'Plugin support',
          ],
          limits: { dailyMessages: 200, monthlyTokens: 5000000, maxFileSizeMb: 25 },
          recommended: true,
        },
        {
          id: 'ULTRA',
          name: 'Ultra',
          price: 100,
          currency: 'USD',
          interval: 'month',
          stripePriceId: config.STRIPE_ULTRA_PRICE_ID,
          features: [
            'Unlimited messages',
            'All models',
            '50MB file uploads',
            'Priority support',
            'Custom workspace',
            'Team management',
            'Advanced analytics',
          ],
          limits: { dailyMessages: -1, monthlyTokens: 50000000, maxFileSizeMb: 50 },
        },
      ],
    })
  })

  // GET /api/v1/subscriptions/current
  app.get('/current', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const subscription = await app.prisma.subscription.findUnique({
      where: { userId: user.sub },
    })
    return reply.send({ success: true, data: subscription })
  })

  // POST /api/v1/subscriptions/create-checkout
  app.post('/create-checkout', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!config.STRIPE_SECRET_KEY) {
      throw new ValidationError('Stripe is not configured')
    }

    const user = request.user as JwtPayload
    const { plan } = request.body as { plan: 'PRO' | 'ULTRA' }

    const priceId = plan === 'PRO' ? config.STRIPE_PRO_PRICE_ID : config.STRIPE_ULTRA_PRICE_ID
    if (!priceId) throw new ValidationError(`Price ID not configured for plan: ${plan}`)

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(config.STRIPE_SECRET_KEY)

    const dbUser = await app.prisma.user.findUnique({
      where: { id: user.sub },
      select: { email: true, displayName: true },
    })
    if (!dbUser) throw new NotFoundError('User')

    // Get or create Stripe customer
    let customerId: string | undefined
    const sub = await app.prisma.subscription.findUnique({ where: { userId: user.sub } })
    if (sub?.stripeCustomerId) {
      customerId = sub.stripeCustomerId
    } else {
      const customer = await stripe.customers.create({
        email: dbUser.email,
        name: dbUser.displayName,
        metadata: { userId: user.sub },
      })
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${config.APP_URL}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.APP_URL}/settings/billing?canceled=true`,
      metadata: { userId: user.sub, plan },
      subscription_data: {
        metadata: { userId: user.sub, plan },
      },
    })

    return reply.send({ success: true, data: { url: session.url, sessionId: session.id } })
  })

  // POST /api/v1/subscriptions/create-portal
  app.post('/create-portal', { preHandler: [app.authenticate] }, async (request, reply) => {
    if (!config.STRIPE_SECRET_KEY) throw new ValidationError('Stripe not configured')

    const user = request.user as JwtPayload
    const sub = await app.prisma.subscription.findUnique({ where: { userId: user.sub } })

    if (!sub?.stripeCustomerId) {
      throw new ValidationError('No active subscription found')
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(config.STRIPE_SECRET_KEY)

    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${config.APP_URL}/settings/billing`,
    })

    return reply.send({ success: true, data: { url: portal.url } })
  })
}
