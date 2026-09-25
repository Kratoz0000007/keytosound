import { useCallback, useEffect, useState } from 'react';
import { login, logout, me, register } from '../session/auth';
import type { User } from '../session/types';

export type AuthStatus = 'loading' | 'in' | 'out';

export interface AuthState {
  user: User | null;
  status: AuthStatus;
}

const LOADING: AuthState = { user: null, status: 'loading' };
const SIGNED_OUT: AuthState = { user: null, status: 'out' };

function signedIn(user: User): AuthState {
  return { user, status: 'in' };
}

/** 200 is in. A 401, or the backend being down, is out: playing never needs a login. */
export async function checkSession(): Promise<AuthState> {
  try {
    return signedIn(await me());
  } catch {
    return SIGNED_OUT;
  }
}

/** Always ends out locally, even if the request fails and the cookie outlives it. */
export async function signOut(): Promise<AuthState> {
  try {
    await logout();
  } catch {
    // Nothing to do: the local state still ends signed out.
  }
  return SIGNED_OUT;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(LOADING);

  useEffect(() => {
    let live = true;
    void checkSession().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, []);

  // Failures propagate to the caller (AuthPanel shows them).
  const doLogin = useCallback(async (email: string, password: string) => {
    setState(signedIn(await login(email, password)));
  }, []);

  const doRegister = useCallback(async (email: string, password: string) => {
    setState(signedIn(await register(email, password)));
  }, []);

  const doLogout = useCallback(async () => {
    setState(await signOut());
  }, []);

  /** The server said 401: switch to out without another request. */
  const expire = useCallback(() => setState(SIGNED_OUT), []);

  return { ...state, login: doLogin, register: doRegister, logout: doLogout, expire };
}
