import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

vi.mock('@/lib/adminOtpMailer', () => ({
  sendAdminOtpEmail: vi.fn(async () => undefined),
}));

import { buildAppForTests } from '@/app';
import { sendAdminOtpEmail } from '@/lib/adminOtpMailer';

describe('API integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildAppForTests();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds to health checks', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('creates a session and returns seed + session id', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sessions/start',
      payload: { mode: 'classic', difficulty: 'easy' },
    });

    expect(response.statusCode).toBe(200);
    const data = response.json();
    expect(data.sessionId).toEqual(expect.any(String));
    expect(data.seed).toEqual(expect.any(Number));
    expect(data.expiresAt).toEqual(expect.any(String));
  });

  it('stores submitted scores and returns leaderboard in descending order', async () => {
    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/api/sessions/start',
      payload: { mode: 'classic', difficulty: 'easy' },
    });
    const { sessionId } = sessionResponse.json();

    const payloads = [1000, 600, 1500].map((score) => ({
      sessionId,
      displayName: `player-${score}`,
      score,
      accuracy: 0.9,
      durationMs: 30000,
      mode: 'classic',
      difficulty: 'easy',
    }));

    for (const payload of payloads) {
      const submitResponse = await app.inject({
        method: 'POST',
        url: '/api/scores/submit',
        payload,
      });

      expect(submitResponse.statusCode).toBe(200);
      expect(submitResponse.json().ok).toBe(true);
    }

    const leaderboard = await app.inject({
      method: 'GET',
      url: '/api/leaderboards?mode=classic&difficulty=easy&limit=3',
    });

    expect(leaderboard.statusCode).toBe(200);
    const body = leaderboard.json();
    expect(body.entries).toHaveLength(3);
    expect(body.entries.map((entry: { score: number }) => entry.score)).toEqual([1500, 1000, 600]);
  });

  it('issues feedback tokens and stores one feedback submission per session', async () => {
    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/api/sessions/start',
      payload: { mode: 'classic', difficulty: 'easy' },
    });
    const { sessionId } = sessionResponse.json();

    const tokenResponse = await app.inject({
      method: 'POST',
      url: '/api/feedback/token',
      payload: { sessionId },
    });

    expect(tokenResponse.statusCode).toBe(200);
    const tokenBody = tokenResponse.json();
    expect(tokenBody.token).toEqual(expect.any(String));
    expect(tokenBody.expiresAt).toEqual(expect.any(String));

    await app.repository.upsertFeedbackToken({
      sessionId,
      tokenHash: createHash('sha256').update(tokenBody.token).digest('hex'),
      issuedAt: new Date(Date.now() - 10_000).toISOString(),
      expiresAt: tokenBody.expiresAt,
      issuedIpHash: null,
      issuedUserAgentHash: null,
    });

    const submitResponse = await app.inject({
      method: 'POST',
      url: '/api/feedback/submit',
      payload: {
        sessionId,
        token: tokenBody.token,
        rating: 5,
        feedback: 'Great flow and readability on mobile.',
        honeypot: '',
        mode: 'arcade',
        difficulty: 1,
        wave: 4,
        score: 1200,
        durationMs: 68000,
        inputMode: 'microphone',
      },
    });

    expect(submitResponse.statusCode).toBe(200);
    expect(submitResponse.json()).toEqual({
      ok: true,
      feedbackId: expect.any(String),
    });

    const duplicateSubmitResponse = await app.inject({
      method: 'POST',
      url: '/api/feedback/submit',
      payload: {
        sessionId,
        token: tokenBody.token,
        rating: 4,
        feedback: 'Second attempt should be blocked.',
        honeypot: '',
        mode: 'arcade',
        difficulty: 1,
        wave: 4,
        score: 1200,
        durationMs: 68000,
        inputMode: 'microphone',
      },
    });

    expect(duplicateSubmitResponse.statusCode).toBe(409);
  });

  it('supports admin OTP login and feedback retrieval', async () => {
    vi.mocked(sendAdminOtpEmail).mockClear();

    const sessionResponse = await app.inject({
      method: 'POST',
      url: '/api/sessions/start',
      payload: { mode: 'classic', difficulty: 'easy' },
    });
    const { sessionId } = sessionResponse.json();

    const feedbackTokenResponse = await app.inject({
      method: 'POST',
      url: '/api/feedback/token',
      payload: { sessionId },
    });
    const feedbackToken = feedbackTokenResponse.json().token as string;

    await app.repository.upsertFeedbackToken({
      sessionId,
      tokenHash: createHash('sha256').update(feedbackToken).digest('hex'),
      issuedAt: new Date(Date.now() - 10_000).toISOString(),
      expiresAt: feedbackTokenResponse.json().expiresAt,
      issuedIpHash: null,
      issuedUserAgentHash: null,
    });

    await app.inject({
      method: 'POST',
      url: '/api/feedback/submit',
      payload: {
        sessionId,
        token: feedbackToken,
        rating: 4,
        feedback: 'The new mobile onboarding is excellent.',
        honeypot: '',
        mode: 'practice',
        difficulty: 2,
        wave: 7,
        score: 2400,
        durationMs: 90000,
        inputMode: 'midi',
      },
    });

    const requestOtpResponse = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/request-otp',
      payload: {
        email: 'tharindarodrigo@gmail.com',
      },
    });

    expect(requestOtpResponse.statusCode).toBe(200);
    expect(requestOtpResponse.json()).toEqual({
      ok: true,
      expiresAt: expect.any(String),
    });

    const mockedMailer = vi.mocked(sendAdminOtpEmail);
    expect(mockedMailer).toHaveBeenCalledTimes(1);
    const otp = mockedMailer.mock.calls[0]?.[0].otp;
    expect(otp).toMatch(/^\d{6}$/);

    const verifyOtpResponse = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/verify-otp',
      payload: {
        email: 'tharindarodrigo@gmail.com',
        otp,
      },
    });

    expect(verifyOtpResponse.statusCode).toBe(200);
    expect(verifyOtpResponse.json()).toEqual({
      ok: true,
      token: expect.any(String),
      expiresAt: expect.any(String),
      admin: {
        id: expect.any(String),
        name: 'Tharinda Rodrigo',
        email: 'tharindarodrigo@gmail.com',
      },
    });

    const unauthorizedResponse = await app.inject({
      method: 'GET',
      url: '/api/admin/feedback',
    });
    expect(unauthorizedResponse.statusCode).toBe(401);

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/admin/feedback?limit=10',
      headers: {
        authorization: `Bearer ${verifyOtpResponse.json().token as string}`,
      },
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual({
      entries: expect.arrayContaining([
        expect.objectContaining({
          sessionId,
          rating: 4,
          feedback: 'The new mobile onboarding is excellent.',
        }),
      ]),
    });
  });
});
