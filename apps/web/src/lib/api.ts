import axios from 'axios'

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
export const API_URL = rawApiUrl.replace(/\/?api\/v1\/?$/i, '').replace(/\/$/, '')

let accessToken: string | null = null
let isRefreshing = false
let refreshQueue: Array<(token: string | null) => void> = []

export function getAccessToken(): string | null {
  if (accessToken) return accessToken
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('token')
  }
  return accessToken
}

export function setAccessToken(token: string) {
  accessToken = token
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token)
  }
}

export function clearAuth() {
  accessToken = null
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token')
    // Zustand persist store ni ham tozalaymiz
    localStorage.removeItem('go-ai-auth')
  }
}

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Request: har doim token qo'shiladi
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response: 401 bo'lganda token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // 401 va refresh hali urinilmagan
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login')
    ) {
      originalRequest._retry = true

      if (isRefreshing) {
        // Boshqa refresh kutilmoqda — queue ga qo'shamiz
        return new Promise((resolve, reject) => {
          refreshQueue.push((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(api(originalRequest))
            } else {
              reject(error)
            }
          })
        })
      }

      isRefreshing = true

      try {
        const { data } = await api.post('/auth/refresh')
        const newToken = data.data.accessToken
        setAccessToken(newToken)

        // Queue dagi barcha requestlarni qayta yubor
        refreshQueue.forEach((cb) => cb(newToken))
        refreshQueue = []

        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh ham muvaffaqiyatsiz — logout
        refreshQueue.forEach((cb) => cb(null))
        refreshQueue = []
        clearAuth()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export function getApiError(error: any): string {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message
    )
  }
  return error instanceof Error ? error.message : String(error)
}

// Streaming SSE — token har doim fresh olish
export async function* streamChat(
  body: unknown,
  signal?: AbortSignal
): AsyncGenerator<{ type: string; [key: string]: unknown }> {
  const token = getAccessToken()

  let response: Response

  try {
    response = await fetch(`${API_URL}/api/v1/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    throw new Error(
      `Cannot connect to API server (${API_URL}).\n` +
      `Make sure the backend is running on port 4000.`
    )
  }

  // 401 — token refresh qilib qayta urinish
  if (response.status === 401) {
    try {
      const refreshRes = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json()
        const newToken = refreshData.data?.accessToken
        if (newToken) {
          setAccessToken(newToken)
          // Qayta urinish
          response = await fetch(`${API_URL}/api/v1/chat/stream`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/event-stream',
              Authorization: `Bearer ${newToken}`,
            },
            credentials: 'include',
            body: JSON.stringify(body),
            signal,
          })
        }
      }
    } catch {
      // Refresh ham ishlamasa login sahifasiga
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error('Authentication required. Please log in again.')
    }
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const json = await response.json()
      message = json?.error?.message ?? json?.message ?? message
    } catch {
      try {
        const text = await response.text()
        if (text) message = text
      } catch {}
    }
    throw new Error(message)
  }

  if (!response.body) throw new Error('Response body is empty.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (!data || data === '[DONE]') continue
      try {
        yield JSON.parse(data)
      } catch {
        // invalid JSON chunk — skip
      }
    }
  }
}