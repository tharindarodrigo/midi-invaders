import { afterEach, describe, expect, it } from 'vitest';
import {
  ADMIN_SESSION_STORAGE_KEY,
  clearStoredAdminSession,
  parseStoredAdminSession,
  persistAdminSession,
  readStoredAdminSession,
} from '@/services/sessionStorage';

describe('sessionStorage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('parses a valid future session', () => {
    const raw = JSON.stringify({
      token: 'token-1',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      admin: {
        id: 'admin-1',
        name: 'Tharinda Rodrigo',
        email: 'tharindarodrigo@gmail.com',
      },
    });

    const parsed = parseStoredAdminSession(raw);
    expect(parsed?.token).toBe('token-1');
    expect(parsed?.admin.email).toBe('tharindarodrigo@gmail.com');
  });

  it('returns null for expired session payload', () => {
    const raw = JSON.stringify({
      token: 'token-1',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      admin: {
        id: 'admin-1',
        name: 'Tharinda Rodrigo',
        email: 'tharindarodrigo@gmail.com',
      },
    });

    expect(parseStoredAdminSession(raw)).toBeNull();
  });

  it('persists and clears session in local storage', () => {
    persistAdminSession({
      token: 'token-2',
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
      admin: {
        id: 'admin-2',
        name: 'Admin User',
        email: 'admin@example.com',
      },
    });

    const stored = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(readStoredAdminSession()?.token).toBe('token-2');

    clearStoredAdminSession();
    expect(window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY)).toBeNull();
  });
});
