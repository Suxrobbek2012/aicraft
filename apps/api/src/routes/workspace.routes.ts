import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { slugify } from '@go-ai/shared'
import { NotFoundError, ForbiddenError } from '../lib/errors'
import type { JwtPayload } from '../plugins/auth.plugin'

const CreateWorkspaceSchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().max(500).optional(),
})

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
})

export default async function workspaceRoutes(app: FastifyInstance) {
  // GET /api/v1/workspaces
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const memberships = await app.prisma.workspaceMember.findMany({
      where: { userId: user.sub },
      include: {
        workspace: {
          include: {
            _count: { select: { members: true, conversations: true } },
          },
        },
      },
    })
    return reply.send({ success: true, data: memberships })
  })

  // POST /api/v1/workspaces
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    if (user.plan === 'FREE') {
      throw new ForbiddenError('Workspaces require PRO plan or higher')
    }

    const input = CreateWorkspaceSchema.parse(request.body)
    let slug = slugify(input.name)

    // Ensure unique slug
    const existing = await app.prisma.workspace.findUnique({ where: { slug } })
    if (existing) slug = `${slug}-${Date.now()}`

    const workspace = await app.prisma.workspace.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        ownerId: user.sub,
        members: {
          create: { userId: user.sub, role: 'OWNER' },
        },
      },
    })

    return reply.status(201).send({ success: true, data: workspace })
  })

  // GET /api/v1/workspaces/:id
  app.get('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }

    const member = await app.prisma.workspaceMember.findFirst({
      where: { workspaceId: id, userId: user.sub },
      include: { workspace: { include: { _count: { select: { members: true } } } } },
    })
    if (!member) throw new NotFoundError('Workspace')

    return reply.send({ success: true, data: member.workspace })
  })

  // GET /api/v1/workspaces/:id/members
  app.get('/:id/members', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }

    const isMember = await app.prisma.workspaceMember.findFirst({
      where: { workspaceId: id, userId: user.sub },
    })
    if (!isMember) throw new ForbiddenError()

    const members = await app.prisma.workspaceMember.findMany({
      where: { workspaceId: id },
      include: { user: { select: { id: true, displayName: true, email: true, avatarUrl: true } } },
    })
    return reply.send({ success: true, data: members })
  })

  // POST /api/v1/workspaces/:id/invite
  app.post('/:id/invite', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }

    const member = await app.prisma.workspaceMember.findFirst({
      where: { workspaceId: id, userId: user.sub, role: { in: ['OWNER', 'ADMIN'] } },
    })
    if (!member) throw new ForbiddenError('Only workspace admins can invite members')

    const { email, role } = InviteMemberSchema.parse(request.body)

    const crypto = await import('crypto')
    const token = crypto.randomBytes(32).toString('hex')

    await app.prisma.workspaceInvite.upsert({
      where: { workspaceId_email: { workspaceId: id, email } },
      update: { token, role: role as any, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      create: {
        workspaceId: id,
        email,
        role: role as any,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: user.sub,
      },
    })

    return reply.send({ success: true, data: { message: `Invitation sent to ${email}` } })
  })

  // POST /api/v1/workspaces/accept-invite/:token
  app.post('/accept-invite/:token', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { token } = request.params as { token: string }

    const invite = await app.prisma.workspaceInvite.findUnique({ where: { token } })
    if (!invite || invite.expiresAt < new Date() || invite.acceptedAt) {
      throw new NotFoundError('Invite')
    }

    await app.prisma.$transaction([
      app.prisma.workspaceMember.create({
        data: { workspaceId: invite.workspaceId, userId: user.sub, role: invite.role },
      }),
      app.prisma.workspaceInvite.update({
        where: { token },
        data: { acceptedAt: new Date() },
      }),
    ])

    return reply.send({ success: true, data: { workspaceId: invite.workspaceId } })
  })

  // DELETE /api/v1/workspaces/:id/members/:userId
  app.delete('/:id/members/:memberId', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id, memberId } = request.params as { id: string; memberId: string }

    const isAdmin = await app.prisma.workspaceMember.findFirst({
      where: { workspaceId: id, userId: user.sub, role: { in: ['OWNER', 'ADMIN'] } },
    })
    if (!isAdmin && memberId !== user.sub) throw new ForbiddenError()

    await app.prisma.workspaceMember.deleteMany({
      where: { workspaceId: id, userId: memberId },
    })

    return reply.send({ success: true, data: { message: 'Member removed' } })
  })
}
