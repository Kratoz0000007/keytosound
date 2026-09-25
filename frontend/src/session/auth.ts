import { request } from './api';
import type { User } from './types';

// Everything goes through request(), so each call sends the session cookie and
// throws ApiError on failure.

function credentials(email: string, password: string): RequestInit {
  return { method: 'POST', body: JSON.stringify({ email, password }) };
}

/** Creates the account and logs it straight in. */
export function register(email: string, password: string): Promise<User> {
  return request<User>('/api/auth/register', credentials(email, password));
}

export function login(email: string, password: string): Promise<User> {
  return request<User>('/api/auth/login', credentials(email, password));
}

export function logout(): Promise<void> {
  return request<void>('/api/auth/logout', { method: 'POST' });
}

/** Page JavaScript cannot see the HttpOnly cookie; this is how the app learns who is logged in. */
export function me(): Promise<User> {
  return request<User>('/api/auth/me');
}
