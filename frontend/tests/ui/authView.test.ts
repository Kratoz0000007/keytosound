import { describe, it, expect } from 'vitest';
import { authErrorMessage, isUnauthorized, saveAreaFor } from '../../src/ui/authView';
import { ApiError } from '../../src/session/api';

describe('saveAreaFor', () => {
  it('shows nothing while the session is being checked', () => {
    expect(saveAreaFor('loading')).toBe('none');
  });

  it('offers a login when logged out', () => {
    expect(saveAreaFor('out')).toBe('login');
  });

  it('shows the save controls when logged in', () => {
    expect(saveAreaFor('in')).toBe('controls');
  });
});

describe('isUnauthorized', () => {
  it('is true only for an ApiError with status 401', () => {
    expect(isUnauthorized(new ApiError('Log in to continue.', 401))).toBe(true);
    expect(isUnauthorized(new ApiError('nope', 404))).toBe(false);
    expect(isUnauthorized(new TypeError('Failed to fetch'))).toBe(false);
  });
});

describe('authErrorMessage', () => {
  it("shows the server's message", () => {
    expect(authErrorMessage(new ApiError('Email or password is incorrect.', 401))).toBe(
      'Email or password is incorrect.',
    );
  });

  it('blames the connection when the request never arrived', () => {
    expect(authErrorMessage(new TypeError('Failed to fetch'))).toBe(
      'Could not reach the server — is the backend running on :8080?',
    );
  });
});
