import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { login, logout, me, register } from '../../src/session/auth';
import { ApiError } from '../../src/session/api';

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

const user = { id: 'u1', email: 'a@x.com' };

describe('register', () => {
  it('posts the credentials with the cookie included', async () => {
    const spy = mockFetch(201, user);

    expect(await register('a@x.com', 'secret-pass')).toEqual(user);

    const [url, init] = spy.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/register$/);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@x.com', password: 'secret-pass' });
  });

  it('throws the server message on a conflict', async () => {
    mockFetch(409, { message: 'An account with that email already exists.' });
    await expect(register('a@x.com', 'secret-pass')).rejects.toMatchObject({
      status: 409,
      message: 'An account with that email already exists.',
    });
  });
});

describe('login', () => {
  it('posts the credentials with the cookie included', async () => {
    const spy = mockFetch(200, user);

    expect(await login('a@x.com', 'secret-pass')).toEqual(user);

    const [url, init] = spy.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/login$/);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({ email: 'a@x.com', password: 'secret-pass' });
  });
});

describe('logout', () => {
  it('posts with the cookie included and resolves on 204', async () => {
    const spy = mockFetch(204, null);

    await logout();

    const [url, init] = spy.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/logout$/);
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
  });
});

describe('me', () => {
  it('gets the current user with the cookie included', async () => {
    const spy = mockFetch(200, user);

    expect(await me()).toEqual(user);

    const [url, init] = spy.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/me$/);
    expect(init.method).toBeUndefined();
    expect(init.credentials).toBe('include');
  });

  it('throws an ApiError with status 401 when logged out', async () => {
    mockFetch(401, { message: 'Log in to continue.' });
    const failure = me();
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status: 401 });
  });
});
