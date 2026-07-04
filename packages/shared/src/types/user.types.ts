export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN'
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED' | 'PENDING_VERIFICATION'
export type SubscriptionPlan = 'FREE' | 'PRO' | 'ULTRA'
export type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'TRIALING' | 'INCOMPLETE'

export interface User {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl?: string | null
  role: UserRole
  status: UserStatus
  plan: SubscriptionPlan
  isEmailVerified: boolean
  twoFactorEnabled: boolean
  createdAt: Date
  updatedAt: Date
  lastActiveAt?: Date | null
  metadata?: Record<string, unknown>
}

export interface UserProfile extends User {
  bio?: string | null
  location?: string | null
  website?: string | null
  language: string
  timezone: string
  tokenBalance: number
  totalTokensUsed: number
  monthlyTokensUsed?: number
  monthlyTokensRemaining?: number
  subscription?: UserSubscription | null
}

export interface UserSubscription {
  id: string
  userId: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  trialEnd?: Date | null
}

export interface UserSettings {
  userId: string
  theme: 'dark' | 'light' | 'system'
  language: string
  defaultModel: string
  defaultProvider: string
  streamResponses: boolean
  soundEnabled: boolean
  autoTitle: boolean
  compactMode: boolean
  codeTheme: string
  fontSize: 'sm' | 'md' | 'lg'
  sendOnEnter: boolean
  showTokenCount: boolean
  ttsEnabled: boolean
  ttsVoice: string
  ttsSpeed: number
  sttEnabled: boolean
  memoryEnabled: boolean
  updatedAt: Date
}
