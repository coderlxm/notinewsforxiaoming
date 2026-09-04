import { requestJson, requestWithoutResponse, jsonRequest } from './client';

export function fetchAuthenticationState(): Promise<{ authenticated: boolean }> {
  return requestJson<{ authenticated: boolean }>('/api/auth/session');
}

export function login(password: string): Promise<void> {
  return requestWithoutResponse('/api/auth/login', jsonRequest('POST', { password }));
}

export function logout(): Promise<void> {
  return requestWithoutResponse('/api/auth/logout', { method: 'POST' });
}
