'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Search, ArrowLeft, MoreHorizontal, Shield, Ban, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface AdminUser {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl?: string
  role: string
  status: string
  plan: string
  createdAt: string
  lastActiveAt?: string
  totalTokensUsed: number
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-secondary text-muted-foreground',
  PRO: 'bg-yellow-500/10 text-yellow-400',
  ULTRA: 'bg-purple-500/10 text-purple-400',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/10 text-green-400',
  SUSPENDED: 'bg-red-500/10 text-red-400',
  PENDING_VERIFICATION: 'bg-yellow-500/10 text-yellow-500',
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/users', { params: { q: q || undefined, page, pageSize: 20 } })
      setUsers(data.data ?? [])
      setTotal(data.meta?.total ?? 0)
    } catch { } finally { setLoading(false) }
  }, [q, page])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleAction = async (userId: string, action: string, value: unknown) => {
    try {
      await api.patch(`/admin/users/${userId}`, { [action]: value })
      await loadUsers()
      toast.success('User updated')
    } catch {
      toast.error('Action failed')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button variant="ghost" size="icon-sm" onClick={() => router.push('/admin')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">User Management</h1>
        <Badge variant="secondary" className="ml-auto">{total.toLocaleString()} users</Badge>
      </div>

      <div className="p-4 border-b border-border">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-2 p-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-secondary/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30">
              <tr>
                {['User', 'Plan', 'Status', 'Role', 'Joined', 'Tokens Used', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback className="text-xs">{user.displayName[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PLAN_COLORS[user.plan]}`}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[user.status] ?? ''}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">{user.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">{formatDate(user.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">{Number(user.totalTokensUsed).toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleAction(user.id, 'plan', 'PRO')}>
                          <Crown className="h-4 w-4 text-yellow-400" /> Set PRO
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAction(user.id, 'plan', 'ULTRA')}>
                          <Crown className="h-4 w-4 text-purple-400" /> Set ULTRA
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleAction(user.id, 'role', 'ADMIN')}>
                          <Shield className="h-4 w-4" /> Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.status === 'ACTIVE' ? (
                          <DropdownMenuItem
                            onClick={() => handleAction(user.id, 'status', 'SUSPENDED')}
                            className="text-destructive focus:text-destructive"
                          >
                            <Ban className="h-4 w-4" /> Suspend
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleAction(user.id, 'status', 'ACTIVE')}>
                            <Shield className="h-4 w-4 text-green-400" /> Unsuspend
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="border-t border-border px-4 py-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} of {total}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}>
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
