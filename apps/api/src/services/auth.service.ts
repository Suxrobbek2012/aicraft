import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import speakeasy from 'speakeasy'
import qrcode from 'qrcode'
import crypto from 'crypto'
import { type PrismaClient, UserStatus, SubscriptionPlan, SubscriptionStatus } from '@go-ai/database'
import { config } from '../config'
import { cacheSet, cacheDel, CACHE_PREFIX } from '../lib/redis'
import {
  UnauthorizedError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../lib/errors'
import type { JwtPayload } from '../plugins/auth.plugin'
import type { RegisterInput, LoginInput } from '@go-ai/shared'

const BCRYPT_ROUNDS = 12
const ACCESS_TOKEN_EXPIRES = config.JWT_ACCESS_EXPIRES
const REFRESH_TOKEN_EXPIRES = config.JWT_REFRESH_EXPIRES

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async register(input: RegisterInput, ipAddress?: string) {
    // Check duplicates
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: input.email.toLowerCase() }, { username: input.username.toLowerCase() }],
      },
    })

    if (existing) {
      if (existing.email === input.email.toLowerCase()) {
        throw new ValidationError('Email already in use')
      }
      throw new ValidationError('Username already taken')
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
    const emailVerifyToken = crypto.randomBytes(32).toString('hex')

    // If no SMTP is configured, activate immediately without email verification
    const smtpConfigured = !!(config.SMTP_USER && config.SMTP_PASS)
    const initialStatus = smtpConfigured ? undefined : UserStatus.ACTIVE
    const isEmailVerified = !smtpConfigured

    const createdUser = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        username: input.username.toLowerCase(),
        displayName: input.displayName ?? input.username,
        passwordHash,
        emailVerifyToken: smtpConfigured ? emailVerifyToken : null,
        emailVerifyExpires: smtpConfigured ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null,
        ...(initialStatus ? { status: initialStatus } : {}),
        isEmailVerified,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        plan: true,
      },
    })

    // Create settings + subscription separately to avoid Prisma nested relation mapping issues
    await Promise.all([
      this.prisma.userSettings.create({
        data: {
          userId: createdUser.id,
          theme: 'dark',
          language: 'en',
          defaultModel: 'llama3.2:1b',
          // defaultModel: 'llama3.2:3b',
          defaultProvider: 'ollama',
        },
      }),
      this.prisma.subscription.create({
        data: {
          userId: createdUser.id,
          plan: SubscriptionPlan.FREE,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      }),
    ])

    return { user: createdUser, emailVerifyToken }
  }

  async login(input: LoginInput, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        plan: true,
        status: true,
        passwordHash: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        isEmailVerified: true,
      },
    })

    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password')
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError('Account suspended. Contact support.')
    }

    if (user.status === UserStatus.DELETED) {
      throw new UnauthorizedError('Invalid email or password')
    }

    const passwordMatch = await bcrypt.compare(input.password, user.passwordHash)
    if (!passwordMatch) {
      throw new UnauthorizedError('Invalid email or password')
    }

    if (user.twoFactorEnabled) {
      if (!input.totpCode) {
        return { requiresTwoFactor: true, userId: user.id }
      }
      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: 'base32',
        token: input.totpCode,
        window: 2,
      })
      if (!verified) {
        throw new UnauthorizedError('Invalid 2FA code')
      }
    }

    // Update last active
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    })

    const tokens = await this.generateTokens(user, ipAddress, userAgent)
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        plan: user.plan,
      },
      ...tokens,
    }
  }

  async generateTokens(
    user: { id: string; email: string; role: string; plan: string },
    ipAddress?: string,
    userAgent?: string
  ) {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role as JwtPayload['role'],
      plan: user.plan,
      type: 'access',
    }

    const accessToken = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES as any,
    })

    const refreshPayload = { ...payload, type: 'refresh' as const }
    const refreshToken = jwt.sign(refreshPayload, config.JWT_REFRESH_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES as any,
    })

    // Store refresh token in DB
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    return { accessToken, refreshToken }
  }

  async refreshAccessToken(refreshToken: string) {
    let payload: JwtPayload
    try {
      payload = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as JwtPayload
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token')
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedError('Invalid token type')
    }

    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: {
        user: { select: { id: true, email: true, role: true, plan: true, status: true } },
      },
    })

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedError('Session expired. Please log in again.')
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenError('Account suspended')
    }

    const accessPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: session.user.id,
      email: session.user.email,
      role: session.user.role as JwtPayload['role'],
      plan: session.user.plan,
      type: 'access',
    }

    const newAccessToken = jwt.sign(accessPayload, config.JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRES as any,
    })

    return { accessToken: newAccessToken }
  }

  async logout(refreshToken: string) {
    await this.prisma.session.deleteMany({ where: { refreshToken } })
  }

  async logoutAll(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } })
    await cacheDel(`${CACHE_PREFIX.USER}${userId}`)
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { emailVerifyToken: token },
    })

    if (!user || !user.emailVerifyExpires || user.emailVerifyExpires < new Date()) {
      throw new ValidationError('Invalid or expired verification token')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        status: UserStatus.ACTIVE,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    })
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // Always return success to prevent email enumeration
    if (!user) return null

    const token = crypto.randomBytes(32).toString('hex')
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    })

    return { user, token }
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { passwordResetToken: token },
    })

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new ValidationError('Invalid or expired reset token')
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })

    // Invalidate all sessions
    await this.logoutAll(user.id)
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user?.passwordHash) throw new NotFoundError('User')

    const match = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!match) throw new ValidationError('Current password is incorrect')

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } })

    // Invalidate all other sessions
    await this.prisma.session.deleteMany({ where: { userId } })
  }

  async setup2FA(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, displayName: true },
    })
    if (!user) throw new NotFoundError('User')

    const secret = speakeasy.generateSecret({
      name: `${config.APP_NAME} (${user.email})`,
      length: 20,
    })

    // Store temp secret in Redis until verified
    await cacheSet(`${CACHE_PREFIX.OTP}2fa:${userId}`, secret.base32, 600)

    const qrCode = await qrcode.toDataURL(secret.otpauth_url!)
    return { secret: secret.base32, qrCode }
  }

  async enable2FA(userId: string, totpCode: string) {
    const { cacheGet } = await import('../lib/redis')
    const secret = await cacheGet<string>(`${CACHE_PREFIX.OTP}2fa:${userId}`)
    if (!secret) throw new ValidationError('2FA setup expired. Please try again.')

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: totpCode,
      window: 2,
    })

    if (!verified) throw new ValidationError('Invalid 2FA code')

    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    )

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        twoFactorBackupCodes: backupCodes,
      },
    })

    await cacheDel(`${CACHE_PREFIX.OTP}2fa:${userId}`)
    return { backupCodes }
  }

  async disable2FA(userId: string, totpCode: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    })

    if (!user?.twoFactorEnabled) throw new ValidationError('2FA is not enabled')

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret!,
      encoding: 'base32',
      token: totpCode,
      window: 2,
    })

    if (!verified) throw new UnauthorizedError('Invalid 2FA code')

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      },
    })
  }
}
