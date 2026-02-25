import type { AdminProfile } from '@midi-invaders/shared';

export const ADMIN_SESSION_STORAGE_KEY = 'midi-invaders-admin-session';

export interface StoredAdminSession {
  token: string;
  expiresAt: string;
  admin: AdminProfile;
}

export const parseStoredAdminSession = (raw: string | null): StoredAdminSession | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAdminSession>;
    if (
      typeof parsed.token !== 'string'
      || typeof parsed.expiresAt !== 'string'
      || typeof parsed.admin !== 'object'
      || parsed.admin === null
      || typeof parsed.admin.id !== 'string'
      || typeof parsed.admin.email !== 'string'
      || typeof parsed.admin.name !== 'string'
    ) {
      return null;
    }

    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return {
      token: parsed.token,
      expiresAt: parsed.expiresAt,
      admin: parsed.admin,
    };
  } catch {
    return null;
  }
};

export const readStoredAdminSession = (): StoredAdminSession | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
  return parseStoredAdminSession(raw);
};

export const persistAdminSession = (session: StoredAdminSession): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredAdminSession = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
};
