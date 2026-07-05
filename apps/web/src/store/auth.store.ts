import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile } from '@go-ai/shared'
import { api, setAccessToken, clearAuth, getApiError } from '@/lib/api'

interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (email: string, password: string, totpCode?: string) => Promise<{ requiresTwoFactor?: boolean }>
  logout: () => Promise<void>
  register: (data: { email: string; username: string; password: string; displayName?: string }) => Promise<void>
  fetchMe: () => Promise<void>
  updateUser: (user: Partial<UserProfile>) => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password, totpCode) => {
        set({ isLoading: true, error: null })
        try {
          const { data } = await api.post('/auth/login', { email, password, totpCode })
          const result = data.data

          if (result.requiresTwoFactor) {
            set({ isLoading: false })
            return { requiresTwoFactor: true }
          }

          setAccessToken(result.accessToken)
          const { useChatStore } = await import('@/store/chat.store')
          const chatState = useChatStore.getState()
          if (chatState.selectedProvider !== 'groq') {
            chatState.setSelectedModel('llama-3.3-70b-versatile', 'groq')
          }
          set({ user: result.user, isAuthenticated: true, isLoading: false })
          return {}
        } catch (err) {
          const message = getApiError(err)
          set({ error: message, isLoading: false })
          throw new Error(message)
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch {}
        clearAuth()
        set({ user: null, isAuthenticated: false, error: null })
      },

      register: async (data) => {
        set({ isLoading: true, error: null })
        try {
          await api.post('/auth/register', data)
          set({ isLoading: false })
        } catch (err) {
          const message = getApiError(err)
          set({ error: message, isLoading: false })
          throw new Error(message)
        }
      },

      fetchMe: async () => {
        set({ isLoading: true })
        try {
          const { data } = await api.get('/auth/me')
          set({ user: data.data, isAuthenticated: true, isLoading: false })
        } catch (err) {
          const status = (err as import('axios').AxiosError)?.response?.status
          if (status === 401) {
            clearAuth()
            set({ user: null, isAuthenticated: false, isLoading: false })
          } else {
            set({ isLoading: false })
          }
        }
      },

      updateUser: (partial) => {
        const current = get().user
        if (current) set({ user: { ...current, ...partial } })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'go-ai-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      // Hydration bo'lganda token localStorage dan tiklaymiz
      onRehydrateStorage: () => (state) => {
        if (state?.isAuthenticated) {
          // localStorage dan tokenni in-memory ga ko'chiramiz
          if (typeof window !== 'undefined') {
            const savedToken = localStorage.getItem('token')
            if (savedToken) {
              setAccessToken(savedToken)
            } else {
              // Token yo'q — fetchMe orqali refresh cookie ishlatiladi
              state.fetchMe()
            }
          }
        }
      },
    }
  )
)
