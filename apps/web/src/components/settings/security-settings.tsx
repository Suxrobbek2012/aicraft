'use client'

import React, { useState } from 'react'
import { Shield, Key, Smartphone, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthStore } from '@/store/auth.store'
import { api, getApiError } from '@/lib/api'
import toast from 'react-hot-toast'

export function SecuritySettings() {
  const { user } = useAuthStore()
  const [changingPassword, setChangingPassword] = useState(false)
  const [setup2FAOpen, setSetup2FAOpen] = useState(false)
  const [qrCode, setQrCode] = useState('')
  const [totpSecret, setTotpSecret] = useState('')
  const [totpCode, setTotpCode] = useState('')

  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  })
  const [showPasswords, setShowPasswords] = useState({ current: false, new: false })

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwords.new !== passwords.confirm) {
      toast.error('Passwords do not match')
      return
    }
    setChangingPassword(true)
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.new,
      })
      toast.success('Password changed successfully')
      setPasswords({ current: '', new: '', confirm: '' })
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setChangingPassword(false)
    }
  }

  const handleSetup2FA = async () => {
    try {
      const { data } = await api.post('/auth/2fa/setup')
      setQrCode(data.data.qrCode)
      setTotpSecret(data.data.secret)
      setSetup2FAOpen(true)
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const handleEnable2FA = async () => {
    try {
      const { data } = await api.post('/auth/2fa/enable', { totpCode })
      toast.success('2FA enabled! Save your backup codes.')
      setSetup2FAOpen(false)
      setTotpCode('')
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-1">Security</h2>
        <p className="text-sm text-muted-foreground">Manage your account security settings</p>
      </div>

      {/* Change Password */}
      <div className="rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Key className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-semibold">Change Password</h3>
            <p className="text-xs text-muted-foreground">Update your account password</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div className="relative">
            <Input
              type={showPasswords.current ? 'text' : 'password'}
              placeholder="Current password"
              value={passwords.current}
              onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
              className="pr-10"
            />
            <button type="button" onClick={() => setShowPasswords((p) => ({ ...p, current: !p.current }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPasswords.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="relative">
            <Input
              type={showPasswords.new ? 'text' : 'password'}
              placeholder="New password"
              value={passwords.new}
              onChange={(e) => setPasswords((p) => ({ ...p, new: e.target.value }))}
              className="pr-10"
            />
            <button type="button" onClick={() => setShowPasswords((p) => ({ ...p, new: !p.new }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Input
            type="password"
            placeholder="Confirm new password"
            value={passwords.confirm}
            onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
          />
          <Button type="submit" size="sm" loading={changingPassword}>Update Password</Button>
        </form>
      </div>

      {/* Two-Factor Authentication */}
      <div className="rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">Two-Factor Authentication</h3>
              <p className="text-xs text-muted-foreground">
                {user?.twoFactorEnabled ? '2FA is enabled' : 'Add extra security to your account'}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={user?.twoFactorEnabled ? 'outline' : 'default'}
            onClick={handleSetup2FA}
          >
            {user?.twoFactorEnabled ? 'Reconfigure' : 'Enable 2FA'}
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-3">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Danger Zone</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <Button size="sm" variant="destructive">Delete Account</Button>
      </div>

      {/* 2FA Setup Dialog */}
      <Dialog open={setup2FAOpen} onOpenChange={setSetup2FAOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up Two-Factor Authentication</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </p>
            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="2FA QR Code" className="h-48 w-48 rounded-xl" />
              </div>
            )}
            <div className="rounded-lg bg-secondary p-3">
              <p className="text-xs text-muted-foreground mb-1">Manual entry key:</p>
              <p className="text-xs font-mono text-foreground break-all">{totpSecret}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Verification Code</label>
              <Input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center text-xl tracking-[0.5em] font-mono"
                maxLength={6}
              />
            </div>
            <Button
              onClick={handleEnable2FA}
              disabled={totpCode.length !== 6}
              className="w-full"
            >
              Verify & Enable
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
