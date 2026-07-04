import nodemailer from 'nodemailer'
import { config } from '../config'
import { logger } from '../lib/logger'

interface EmailPayload {
  to: string
  subject: string
  html: string
  text?: string
}

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth:
        config.SMTP_USER && config.SMTP_PASS
          ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
          : undefined,
    })
  }
  return transporter
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!config.SMTP_USER) {
    logger.debug({ to: payload.to, subject: payload.subject }, 'Email skipped (no SMTP configured)')
    return
  }

  try {
    await getTransporter().sendMail({
      from: config.EMAIL_FROM,
      ...payload,
    })
    logger.debug({ to: payload.to, subject: payload.subject }, 'Email sent')
  } catch (err) {
    logger.error({ err, to: payload.to }, 'Email send failed')
    throw err
  }
}

export function buildVerificationEmail(displayName: string, verifyUrl: string): EmailPayload['html'] {
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, sans-serif; background: #111; color: #fff; padding: 40px;">
        <div style="max-width: 600px; margin: 0 auto; background: #181818; border: 1px solid #2a2a2a; border-radius: 12px; padding: 40px;">
          <h1 style="color: #86efac; margin-top: 0;">Verify your email</h1>
          <p>Hi ${displayName},</p>
          <p>Welcome to aicraft! Please verify your email address to get started.</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #16a34a; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 20px 0;">
            Verify Email
          </a>
          <p style="color: #888; font-size: 14px;">This link expires in 24 hours. If you didn't sign up, ignore this email.</p>
        </div>
      </body>
    </html>
  `
}

export function buildPasswordResetEmail(displayName: string, resetUrl: string): EmailPayload['html'] {
  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, sans-serif; background: #111; color: #fff; padding: 40px;">
        <div style="max-width: 600px; margin: 0 auto; background: #181818; border: 1px solid #2a2a2a; border-radius: 12px; padding: 40px;">
          <h1 style="color: #86efac; margin-top: 0;">Reset your password</h1>
          <p>Hi ${displayName},</p>
          <p>We received a request to reset your password.</p>
          <a href="${resetUrl}" style="display: inline-block; background: #16a34a; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 20px 0;">
            Reset Password
          </a>
          <p style="color: #888; font-size: 14px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
      </body>
    </html>
  `
}
