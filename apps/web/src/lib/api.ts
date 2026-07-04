import axios from 'axios'

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

let accessToken: string | null = null

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
  }
}

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
})

// Request interceptor to attach bearer token
api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function getApiError(error: any): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message || error.response?.data?.message || error.message
  }
  return error instanceof Error ? error.message : String(error)
}

// Streaming SSE helper
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
    console.error('Network Error:', error)

    throw new Error(
      `Cannot connect to ${API_URL}.
Make sure:
1. Backend is running.
2. API URL is correct.
3. CORS is configured.
4. PostgreSQL and Redis are running.`
    )
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`

    try {
      const json = await response.json()
      message =
        json?.error?.message ??
        json?.message ??
        message
    } catch {
      try {
        const text = await response.text()
        if (text) message = text
      } catch {}
    }

    throw new Error(message)
  }

  if (!response.body) {
    throw new Error('Response body is empty.')
  }

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
      } catch (err) {
        console.warn('Invalid SSE JSON:', data)
      }
    }
  }
}