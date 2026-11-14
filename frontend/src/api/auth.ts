import { request } from './http'

export interface User {
  id: string
  email: string
  full_name: string
  created_at: string
}

export interface RegisterPayload {
  email: string
  password: string
  full_name: string
}

export interface LoginPayload {
  email: string
  password: string
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<User>('/auth/register', { method: 'POST', body: payload }),
  login: (payload: LoginPayload) => request<User>('/auth/login', { method: 'POST', body: payload }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<User>('/users/me'),
  updateMe: (changes: Partial<Pick<User, 'full_name'>>) =>
    request<User>('/users/me', { method: 'PATCH', body: changes }),
}
