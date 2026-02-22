import { randomUUID } from 'node:crypto';
import type {
  GameSessionStartRequest,
  LeaderboardEntry,
  ScoreSubmitRequest,
  ScoreSubmitResponse,
} from '@midi-invaders/shared';
import type { ApiRepository, SessionRecord } from '@/lib/types';

export class InMemoryRepository implements ApiRepository {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly scores: LeaderboardEntry[] = [];

  async createSession(input: GameSessionStartRequest): Promise<SessionRecord> {
    const session: SessionRecord = {
      sessionId: randomUUID(),
      seed: Math.floor(Math.random() * 1_000_000_000),
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
      mode: input.mode,
      difficulty: input.difficulty,
    };

    this.sessions.set(session.sessionId, session);
    return session;
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async createScore(input: ScoreSubmitRequest): Promise<ScoreSubmitResponse> {
    const submissionId = randomUUID();
    this.scores.push({
      submissionId,
      displayName: input.displayName,
      score: input.score,
      accuracy: input.accuracy,
      durationMs: input.durationMs,
      mode: input.mode,
      difficulty: input.difficulty,
      createdAt: new Date().toISOString(),
    });

    return {
      ok: true,
      submissionId,
    };
  }

  async getLeaderboard(input: {
    mode: SessionRecord['mode'];
    difficulty: SessionRecord['difficulty'];
    limit: number;
  }): Promise<LeaderboardEntry[]> {
    return this.scores
      .filter((entry) => entry.mode === input.mode && entry.difficulty === input.difficulty)
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limit);
  }
}
