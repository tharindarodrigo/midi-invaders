import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAdminFeedback,
  requestAdminOtp,
  verifyAdminOtp,
} from '@/services/adminApi';

const jsonResponse = <T>(body: T, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

describe('adminApi service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('requests OTP via POST /api/admin/auth/request-otp', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ ok: true, expiresAt: '2026-02-25T12:00:00.000Z' }),
    );

    const result = await requestAdminOtp('tharindarodrigo@gmail.com');

    expect(result).toEqual({
      ok: true,
      expiresAt: '2026-02-25T12:00:00.000Z',
    });
    expect(fetchSpy).toHaveBeenCalledWith('/api/admin/auth/request-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'tharindarodrigo@gmail.com',
      }),
    });
  });

  it('verifies OTP via POST /api/admin/auth/verify-otp', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        ok: true,
        token: 'token-value',
        expiresAt: '2026-02-26T12:00:00.000Z',
        admin: {
          id: 'admin-tharinda-rodrigo',
          name: 'Tharinda Rodrigo',
          email: 'tharindarodrigo@gmail.com',
        },
      }),
    );

    const result = await verifyAdminOtp({
      email: 'tharindarodrigo@gmail.com',
      otp: '123456',
    });

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith('/api/admin/auth/verify-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'tharindarodrigo@gmail.com',
        otp: '123456',
      }),
    });
  });

  it('fetches admin feedback with bearer token', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ entries: [] }),
    );

    const result = await fetchAdminFeedback('token-value', 25);

    expect(result).toEqual({ entries: [] });
    expect(fetchSpy).toHaveBeenCalledWith('/api/admin/feedback?limit=25', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer token-value',
      },
      body: undefined,
    });
  });
});
