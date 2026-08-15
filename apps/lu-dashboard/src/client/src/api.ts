import type { DashboardResponse } from '../../shared/dashboard'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(await response.text())
  }
  return response.json() as Promise<T>
}

export function getSession() {
  return request<{ authenticated: boolean }>('/api/session')
}

export function login(password: string) {
  return request<{ authenticated: boolean }>('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
}

export function logout() {
  return request<{ authenticated: boolean }>('/api/session', { method: 'DELETE' })
}

export function getDashboard() {
  return request<DashboardResponse>('/api/dashboard')
}
