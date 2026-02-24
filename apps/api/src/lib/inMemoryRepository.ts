import { randomUUID } from 'node:crypto';
import type {
  FeedbackSubmitResponse,
  GameSessionStartRequest,
  LeaderboardEntry,
  ScoreSubmitRequest,
  ScoreSubmitResponse,
} from '@midi-invaders/shared';
import type {
  ApiRepository,
  FeedbackSubmissionCreateInput,
  FeedbackTokenRecord,
  SessionRecord,
} from '@/lib/types';

export class InMemoryRepository implements ApiRepository {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly scores: LeaderboardEntry[] = [];
  private readonly feedbackTokens = new Map<string, FeedbackTokenRecord>();
  private readonly feedbackBySessionId = new Map<string, {
    id: string;
    createdAt: string;
    payload: FeedbackSubmissionCreateInput;
  }>();

  async createSession(input: GameSessionStartRequest): Promise<SessionRecord> {
    const createdAt = new Date().toISOString();
    const session: SessionRecord = {
      sessionId: randomUUID(),
      seed: Math.floor(Math.random() * 1_000_000_000),
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
      mode: input.mode,
      difficulty: input.difficulty,
      createdAt,
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

  async upsertFeedbackToken(input: {
    sessionId: string;
    tokenHash: string;
    issuedAt: string;
    expiresAt: string;
    issuedIpHash: string | null;
    issuedUserAgentHash: string | null;
  }): Promise<void> {
    this.feedbackTokens.set(input.sessionId, {
      sessionId: input.sessionId,
      tokenHash: input.tokenHash,
      issuedAt: input.issuedAt,
      expiresAt: input.expiresAt,
      usedAt: null,
    });
  }

  async getFeedbackToken(sessionId: string): Promise<FeedbackTokenRecord | null> {
    return this.feedbackTokens.get(sessionId) ?? null;
  }

  async consumeFeedbackToken(input: {
    sessionId: string;
    tokenHash: string;
    now: string;
  }): Promise<boolean> {
    const existing = this.feedbackTokens.get(input.sessionId);
    if (!existing) {
      return false;
    }

    if (existing.tokenHash !== input.tokenHash || existing.usedAt !== null) {
      return false;
    }

    if (new Date(existing.expiresAt).getTime() <= new Date(input.now).getTime()) {
      return false;
    }

    this.feedbackTokens.set(input.sessionId, {
      ...existing,
      usedAt: input.now,
    });

    return true;
  }

  async hasFeedbackSubmission(sessionId: string): Promise<boolean> {
    return this.feedbackBySessionId.has(sessionId);
  }

  async createFeedbackSubmission(input: FeedbackSubmissionCreateInput): Promise<FeedbackSubmitResponse> {
    const existing = this.feedbackBySessionId.get(input.sessionId);
    if (existing) {
      throw new Error('feedback_already_submitted');
    }

    const feedbackId = randomUUID();
    this.feedbackBySessionId.set(input.sessionId, {
      id: feedbackId,
      createdAt: new Date().toISOString(),
      payload: input,
    });

    return {
      ok: true,
      feedbackId,
    };
  }
}
