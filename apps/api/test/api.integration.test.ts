import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildAppForTests } from '@/app';

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
});
