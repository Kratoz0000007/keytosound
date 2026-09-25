import { ApiError } from '../session/api';
import type { AuthStatus } from './useAuth';

export type SaveArea = 'none' | 'login' | 'controls';

/** What the save area shows. Typing and playback never depend on this. */
export function saveAreaFor(status: AuthStatus): SaveArea {
  if (status === 'in') return 'controls';
  return status === 'out' ? 'login' : 'none';
}

/** A 401 means the session is gone: expired, tampered with, or the account deleted. */
export function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiError && err.status === 401;
}

/** The server's message when there is one; otherwise the request never arrived. */
export function authErrorMessage(err: unknown): string {
  return err instanceof ApiError
    ? err.message
    : 'Could not reach the server — is the backend running on :8080?';
}
