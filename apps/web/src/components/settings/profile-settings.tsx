'use client'

import React, { useState } from 'react'
import { Camera, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuthStore } from '@/store/auth.store'
import { api, getApiError } from '@/lib/api'
import toast from 'react-hot-toast'

export function ProfileSettings() {
  const { user, updateUser, fetchMe } = useAuthStore()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    displayName: user?.displayName ?? '',
    bio: user?.bio ?? '',
    location: user?.location ?? '',
    website: user?.website ?? '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.patch('/users/me', form)
      await fetchMe()
      toast.success('Profile updated')
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('avatar', file)
    try {
      const { data } = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      updateUser({ avatarUrl: data.data.avatarUrl })
      toast.success('Avatar updated')
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-1">Profile</h2>
        <p className="text-sm text-muted-foreground">Manage your public profile information</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <Avatar className="h-16 w-16">
            <AvatarImage src={user?.avatarUrl ?? undefined} />
            <AvatarFallback className="text-lg">{user?.displayName?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <label className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors">
            <Camera className="h-3 w-3 text-white" />
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </label>
        </div>
        <div>
          <p className="text-sm font-medium">{user?.displayName}</p>
          <p className="text-xs text-muted-foreground">@{user?.username} · {user?.email}</p>
          <p className="text-xs text-muted-foreground mt-0.5">JPG or PNG, max 5MB</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Display Name</label>
          <Input name="displayName" value={form.displayName} onChange={handleChange} placeholder="Your name" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Bio</label>
          <Textarea
            name="bio"
            value={form.bio}
            onChange={handleChange}
            placeholder="Tell us about yourself..."
            className="min-h-[80px]"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">{form.bio.length}/500</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Location</label>
            <Input name="location" value={form.location} onChange={handleChange} placeholder="City, Country" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Website</label>
            <Input name="website" value={form.website} onChange={handleChange} placeholder="https://" type="url" />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} loading={saving} className="gap-2">
        <Save className="h-4 w-4" />
        Save Changes
      </Button>
    </div>
  )
}
