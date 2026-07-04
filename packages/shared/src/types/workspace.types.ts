export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'

export interface Workspace {
  id: string
  name: string
  slug: string
  description?: string | null
  avatarUrl?: string | null
  ownerId: string
  plan: string
  isPersonal: boolean
  settings: WorkspaceSettings
  memberCount: number
  createdAt: Date
  updatedAt: Date
}

export interface WorkspaceSettings {
  defaultModel: string
  defaultProvider: string
  allowedModels: string[]
  allowFileUploads: boolean
  maxFileSizeMb: number
  allowApiAccess: boolean
  requireApproval: boolean
  customSystemPrompt?: string
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  joinedAt: Date
  invitedBy?: string | null
  user?: {
    id: string
    displayName: string
    email: string
    avatarUrl?: string | null
  }
}

export interface WorkspaceInvite {
  id: string
  workspaceId: string
  email: string
  role: WorkspaceRole
  token: string
  expiresAt: Date
  acceptedAt?: Date | null
  createdBy: string
  createdAt: Date
}
