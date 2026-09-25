import { useState, type FormEvent } from 'react';
import { authErrorMessage } from './authView';

type Mode = 'login' | 'register';

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  onClose: () => void;
}

/** Inline, on the page's white background: not a modal, so the typing area stays visible. */
export function AuthPanel({ onLogin, onRegister, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await (mode === 'login' ? onLogin : onRegister)(email.trim(), password);
      onClose();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const tab = (active: boolean) =>
    active ? 'font-semibold underline underline-offset-4' : 'text-neutral-500 hover:text-neutral-900';

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-3 rounded border border-neutral-200 bg-white p-4"
    >
      <div className="flex gap-4 text-sm">
        <button type="button" onClick={() => switchMode('login')} className={tab(mode === 'login')}>
          Log in
        </button>
        <button
          type="button"
          onClick={() => switchMode('register')}
          className={tab(mode === 'register')}
        >
          Create account
        </button>
      </div>
      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="rounded border border-neutral-300 px-3 py-2"
      />
      <input
        type="password"
        required
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={mode === 'register' ? 'Password (8 or more characters)' : 'Password'}
        className="rounded border border-neutral-300 px-3 py-2"
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-neutral-900 px-4 py-2 text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-neutral-300 px-4 py-2 hover:bg-neutral-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
