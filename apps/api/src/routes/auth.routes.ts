import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { AuthService } from '../services/auth.service'
import {
  RegisterSchema,
  LoginSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ChangePasswordSchema,
  RefreshTokenSchema,
  Enable2FASchema,
  PLAN_LIMITS,
} from '@go-ai/shared'
import { QUEUES } from '../plugins/bullmq.plugin'
import { buildVerificationEmail, buildPasswordResetEmail } from '../services/email.service'
import { getUserUsageStats } from '../services/usage.service'
import { NotFoundError } from '../lib/errors'
import { config } from '../config'
import type { JwtPayload } from '../plugins/auth.plugin'

export default async function authRoutes(app: FastifyInstance) {
  const authService = new AuthService(app.prisma)

  // POST /api/v1/auth/register
  app.post('/register', async (request, reply) => {
    let input
    try {
      input = RegisterSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        const firstIssue = err.issues[0]
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: firstIssue?.message ?? 'Validation error',
            details: err.issues,
          },
        })
      }
      throw err
    }
    const { user, emailVerifyToken } = await authService.register(input, request.ip)

    // Only send verification email if SMTP is configured
    if (emailVerifyToken) {
      await app.queues.get(QUEUES.EMAIL)?.add('verify-email', {
        to: user.email,
        subject: 'Verify your aicraft account',
        html: buildVerificationEmail(
          user.displayName,
          `${config.APP_URL}/verify-email?token=${emailVerifyToken}`
        ),
      })
    }

    return reply.status(201).send({
      success: true,
      data: {
        message: emailVerifyToken
          ? 'Account created. Please verify your email.'
          : 'Account created successfully. You can now log in.',
        user,
      },
    })
  })

  // POST /api/v1/auth/login
  app.post('/login', async (request, reply) => {
    let input
    try {
      input = LoginSchema.parse(request.body)
    } catch (err) {
      if (err instanceof ZodError) {
        const firstIssue = err.issues[0]
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: firstIssue?.message ?? 'Validation error',
            details: err.issues,
          },
        })
      }
      throw err
    }
    const result = await authService.login(input, request.ip, request.headers['user-agent'])

    if ('requiresTwoFactor' in result) {
      return reply.send({ success: true, data: { requiresTwoFactor: true } })
    }

    // Set refresh token as httpOnly cookie
    reply.setCookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60,
    })

    return reply.send({
      success: true,
      data: {
        accessToken: result.accessToken,
        user: result.user,
      },
    })
  })

  // POST /api/v1/auth/refresh
  app.post('/refresh', async (request, reply) => {
    const body = RefreshTokenSchema.safeParse(request.body)
    const cookieToken = request.cookies?.refreshToken
    const refreshToken = body.success ? body.data.refreshToken : cookieToken

    if (!refreshToken) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'No refresh token' } })
    }

    const { accessToken } = await authService.refreshAccessToken(refreshToken)
    return reply.send({ success: true, data: { accessToken } })
  })

  // POST /api/v1/auth/logout
  app.post('/logout', { preHandler: [app.authenticate] }, async (request, reply) => {
    const cookieToken = request.cookies?.refreshToken
    if (cookieToken) {
      await authService.logout(cookieToken)
    }
    reply.clearCookie('refreshToken', { path: '/api/v1/auth' })
    return reply.send({ success: true, data: { message: 'Logged out' } })
  })

  // POST /api/v1/auth/logout-all
  app.post('/logout-all', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    await authService.logoutAll(user.sub)
    reply.clearCookie('refreshToken', { path: '/api/v1/auth' })
    return reply.send({ success: true, data: { message: 'Logged out from all devices' } })
  })

  // GET /api/v1/auth/verify-email
  app.get('/verify-email', async (request, reply) => {
    const { token } = request.query as { token: string }
    if (!token) {
      return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Token required' } })
    }
    await authService.verifyEmail(token)
    return reply.send({ success: true, data: { message: 'Email verified successfully' } })
  })

  // POST /api/v1/auth/forgot-password
  app.post('/forgot-password', async (request, reply) => {
    const { email } = ForgotPasswordSchema.parse(request.body)
    const result = await authService.forgotPassword(email)

    if (result) {
      await app.queues.get(QUEUES.EMAIL)?.add('password-reset', {
        to: result.user.email,
        subject: 'Reset your aicraft password',
        html: buildPasswordResetEmail(
          result.user.displayName,
          `${config.APP_URL}/reset-password?token=${result.token}`
        ),
      })
    }

    // Always return success to prevent email enumeration
    return reply.send({ success: true, data: { message: 'If that email exists, a reset link has been sent.' } })
  })

  // POST /api/v1/auth/reset-password
  app.post('/reset-password', async (request, reply) => {
    const { token, password } = ResetPasswordSchema.parse(request.body)
    await authService.resetPassword(token, password)
    return reply.send({ success: true, data: { message: 'Password reset successfully' } })
  })

  // POST /api/v1/auth/change-password
  app.post('/change-password', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(request.body)
    await authService.changePassword(user.sub, currentPassword, newPassword)
    return reply.send({ success: true, data: { message: 'Password changed successfully' } })
  })

  // POST /api/v1/auth/2fa/setup
  app.post('/2fa/setup', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const result = await authService.setup2FA(user.sub)
    return reply.send({ success: true, data: result })
  })

  // POST /api/v1/auth/2fa/enable
  app.post('/2fa/enable', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { totpCode } = Enable2FASchema.parse(request.body)
    const result = await authService.enable2FA(user.sub, totpCode)
    return reply.send({ success: true, data: result })
  })

  // POST /api/v1/auth/2fa/disable
  app.post('/2fa/disable', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { totpCode } = Enable2FASchema.parse(request.body)
    await authService.disable2FA(user.sub, totpCode)
    return reply.send({ success: true, data: { message: '2FA disabled' } })
  })

  // GET /api/v1/auth/me
  app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const fullUser = await app.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        status: true,
        plan: true,
        isEmailVerified: true,
        twoFactorEnabled: true,
        tokenBalance: true,
        totalTokensUsed: true,
        language: true,
        timezone: true,
        bio: true,
        location: true,
        website: true,
        lastActiveAt: true,
        createdAt: true,
        settings: true,
        subscription: true,
      },
    })

    if (!fullUser) throw new NotFoundError('User')

    const usageStats = await getUserUsageStats(app.prisma, user.sub, 'month')
    const planLimits = PLAN_LIMITS[fullUser.plan as keyof typeof PLAN_LIMITS]
    const monthlyTokensUsed = usageStats.totalTokens
    const monthlyTokensRemaining = Math.max(0, planLimits.monthlyTokens - monthlyTokensUsed)

    return reply.send({
      success: true,
      data: {
        ...fullUser,
        monthlyTokensUsed,
        monthlyTokensRemaining,
      },
    })
  })
}
