import type { FastifyInstance } from 'fastify'
import { config } from '../config'
import { logger } from '../lib/logger'

export default async function webhookRoutes(app: FastifyInstance) {
  // POST /webhooks/stripe
  app.post(
    '/stripe',
    {
      config: { rawBody: true },
    },
    async (request, reply) => {
      if (!config.STRIPE_SECRET_KEY || !config.STRIPE_WEBHOOK_SECRET) {
        return reply.status(400).send({ error: 'Stripe not configured' })
      }

      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(config.STRIPE_SECRET_KEY)

      const sig = request.headers['stripe-signature'] as string
      let event: import('stripe').Stripe.Event

      try {
        event = stripe.webhooks.constructEvent(
          (request as unknown as { rawBody: Buffer }).rawBody,
          sig,
          config.STRIPE_WEBHOOK_SECRET
        )
      } catch (err) {
        logger.error({ err }, 'Stripe webhook signature verification failed')
        return reply.status(400).send({ error: 'Invalid signature' })
      }

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as import('stripe').Stripe.Checkout.Session
            const userId = session.metadata?.userId
            const plan = session.metadata?.plan as 'PRO' | 'ULTRA'

            if (userId && plan) {
              const subscription = await stripe.subscriptions.retrieve(
                session.subscription as string
              )
              await app.prisma.subscription.upsert({
                where: { userId },
                update: {
                  plan: plan as any,
                  status: 'ACTIVE',
                  stripeCustomerId: session.customer as string,
                  stripeSubscriptionId: session.subscription as string,
                  currentPeriodStart: new Date(subscription.current_period_start * 1000),
                  currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                  cancelAtPeriodEnd: false,
                },
                create: {
                  userId,
                  plan: plan as any,
                  status: 'ACTIVE',
                  stripeCustomerId: session.customer as string,
                  stripeSubscriptionId: session.subscription as string,
                  currentPeriodStart: new Date(subscription.current_period_start * 1000),
                  currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                },
              })

              await app.prisma.user.update({
                where: { id: userId },
                data: { plan: plan as any },
              })
            }
            break
          }

          case 'customer.subscription.updated': {
            const sub = event.data.object as import('stripe').Stripe.Subscription
            const userId = sub.metadata?.userId
            if (userId) {
              const plan = (sub.metadata?.plan as 'PRO' | 'ULTRA') ?? 'FREE'
              const statusMap: Record<string, string> = {
                active: 'ACTIVE',
                canceled: 'CANCELED',
                past_due: 'PAST_DUE',
                trialing: 'TRIALING',
                incomplete: 'INCOMPLETE',
              }
              await app.prisma.subscription.update({
                where: { userId },
                data: {
                  status: (statusMap[sub.status] ?? 'ACTIVE') as any,
                  cancelAtPeriodEnd: sub.cancel_at_period_end,
                  currentPeriodEnd: new Date(sub.current_period_end * 1000),
                },
              })
            }
            break
          }

          case 'customer.subscription.deleted': {
            const sub = event.data.object as import('stripe').Stripe.Subscription
            const userId = sub.metadata?.userId
            if (userId) {
              await app.prisma.subscription.update({
                where: { userId },
                data: { status: 'CANCELED', plan: 'FREE' as any },
              })
              await app.prisma.user.update({
                where: { id: userId },
                data: { plan: 'FREE' as any },
              })
            }
            break
          }
        }

        return reply.send({ received: true })
      } catch (err) {
        logger.error({ err, eventType: event.type }, 'Stripe webhook processing error')
        return reply.status(500).send({ error: 'Webhook processing failed' })
      }
    }
  )
}
