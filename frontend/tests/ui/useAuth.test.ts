import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkSession, signOut } from '../../src/ui/useAuth';

function mockFetch(status: number, body: unknown) {
  const spy = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('checkSession', () => {
  it('is in when /me answers 200', async () => {
    mockFetch(200, { id: 'u1', email: 'a@x.com' });
    expect(await checkSession()).toEqual({ status: 'in', user: { id: 'u1', email: 'a@x.com' } });
  });

  it('is out when /me answers 401', async () => {
    mockFetch(401, { message: 'Log in to continue.' });
    expect(await checkSession()).toEqual({ status: 'out', user: null });
  });

  it('is out when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await checkSession()).toEqual({ status: 'out', user: null });
  });
});

describe('signOut', () => {
  it('ends out after a successful logout', async () => {
    mockFetch(204, null);
    expect(await signOut()).toEqual({ status: 'out', user: null });
  });

  it('still ends out when the logout request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await signOut()).toEqual({ status: 'out', user: null });
  });
});
