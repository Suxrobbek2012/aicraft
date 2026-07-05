'use client'

import React, { useEffect, useState } from 'react'
import { Plus, Trash2, Copy, Check, Eye, EyeOff, Key } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { api, getApiError } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import copy from 'copy-to-clipboard'
import toast from 'react-hot-toast'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  totalRequests: number
  lastUsedAt?: string
  expiresAt?: string
  createdAt: string
}

export function ApiKeysSettings() {
  const { user } = useAuthStore()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newKeyData, setNewKeyData] = useState({ name: '', scopes: ['chat_read', 'chat_write'] })
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const isPro = user?.plan === 'PRO' || user?.plan === 'ULTRA'

  useEffect(() => {
    loadKeys()
  }, [])

  const loadKeys = async () => {
    try {
      const { data } = await api.get('/api-keys')
      setKeys(data.data ?? [])
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newKeyData.name) return
    setCreating(true)
    try {
      const { data } = await api.post('/api-keys', newKeyData)
      setCreatedKey(data.data.key)
      await loadKeys()
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    try {
      await api.delete(`/api-keys/${id}`)
      setKeys((prev) => prev.filter((k) => k.id !== id))
      toast.success('API key revoked')
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const handleCopy = (text: string, id: string) => {
    copy(text)
    setCopiedId(id)
    toast.success('Copied!')
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold mb-1">API Keys</h2>
          <p className="text-sm text-muted-foreground">Manage API access for third-party integrations</p>
        </div>
        {isPro ? (
          <Button size="sm" onClick={() => { setCreateOpen(true); setCreatedKey(null) }} className="gap-2">
            <Plus className="h-4 w-4" /> New Key
          </Button>
        ) : (
          <Badge variant="secondary">PRO required</Badge>
        )}
      </div>

      {!isPro && (
        <div className="rounded-xl border border-border bg-secondary/30 p-6 text-center">
          <Key className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-1">API Access requires PRO</h3>
          <p className="text-sm text-muted-foreground mb-4">Upgrade to PRO to create API keys and access aicraft programmatically</p>
          <Button size="sm" onClick={() => window.location.href = '/settings/billing'}>Upgrade to PRO</Button>
        </div>
      )}

      {isPro && (
        <>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-secondary/40 animate-pulse" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <div className="rounded-xl border border-border bg-secondary/20 py-12 text-center">
              <p className="text-sm text-muted-foreground">No API keys yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div key={key.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{key.name}</span>
                      <Badge variant="outline" className="font-mono text-xs">{key.keyPrefix}***</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {formatDate(key.createdAt)} ·{' '}
                      {key.lastUsedAt ? `Last used ${formatDate(key.lastUsedAt)}` : 'Never used'} ·{' '}
                      {Number(key.totalRequests).toLocaleString()} requests
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRevoke(key.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdKey ? 'API Key Created' : 'Create API Key'}</DialogTitle>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <p className="text-sm text-amber-400 bg-amber-400/10 rounded-xl p-3 border border-amber-400/20">
                ⚠️ Copy your key now — it won&apos;t be shown again!
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary p-3">
                <code className="flex-1 text-xs font-mono text-foreground break-all">{createdKey}</code>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => handleCopy(createdKey, 'new')}
                >
                  {copiedId === 'new' ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button className="w-full" onClick={() => { setCreateOpen(false); setCreatedKey(null) }}>Done</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Key Name</label>
                <Input
                  placeholder="My App"
                  value={newKeyData.name}
                  onChange={(e) => setNewKeyData((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} loading={creating} disabled={!newKeyData.name}>Create Key</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
