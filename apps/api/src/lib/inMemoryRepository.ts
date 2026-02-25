import { randomUUID } from 'node:crypto';
import type {
  AdminFeedbackEntry,
  AdminProfile,
  FeedbackSubmitResponse,
  GameSessionStartRequest,
  LeaderboardEntry,
  ScoreSubmitRequest,
  ScoreSubmitResponse,
} from '@midi-invaders/shared';
import type {
  ApiRepository,
  FeedbackSubmissionCreateInput,
  AdminOtpChallengeRecord,
  AdminSessionRecord,
  FeedbackTokenRecord,
  SessionRecord,
} from '@/lib/types';

const DEFAULT_ADMIN_USERS: AdminProfile[] = [
  {
    id: 'admin-tharinda-rodrigo',
    name: 'Tharinda Rodrigo',
    email: 'tharindarodrigo@gmail.com',
  },
];

export class InMemoryRepository implements ApiRepository {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly scores: LeaderboardEntry[] = [];
  private readonly feedbackTokens = new Map<string, FeedbackTokenRecord>();
  private readonly feedbackBySessionId = new Map<string, {
    id: string;
    createdAt: string;
    payload: FeedbackSubmissionCreateInput;
  }>();
  private readonly adminUsersByEmail = new Map<string, AdminProfile>();
  private readonly adminUsersById = new Map<string, AdminProfile>();
  private readonly adminOtpChallenges = new Map<string, AdminOtpChallengeRecord>();
  private readonly adminSessionsByTokenHash = new Map<string, Omit<AdminSessionRecord, 'admin'>>();

  constructor() {
    for (const adminUser of DEFAULT_ADMIN_USERS) {
      this.adminUsersByEmail.set(adminUser.email.toLowerCase(), adminUser);
      this.adminUsersById.set(adminUser.id, adminUser);
    }
  }

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

  async getAdminUserByEmail(email: string): Promise<AdminProfile | null> {
    return this.adminUsersByEmail.get(email.toLowerCase()) ?? null;
  }

  async createAdminOtpChallenge(input: {
    adminUserId: string;
    otpHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<AdminOtpChallengeRecord> {
    const challenge: AdminOtpChallengeRecord = {
      id: randomUUID(),
      adminUserId: input.adminUserId,
      otpHash: input.otpHash,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      consumedAt: null,
    };
    this.adminOtpChallenges.set(challenge.id, challenge);
    return challenge;
  }

  async consumeAdminOtpChallenge(input: {
    adminUserId: string;
    otpHash: string;
    now: string;
  }): Promise<boolean> {
    const nowMs = new Date(input.now).getTime();
    const matchingChallenge = [...this.adminOtpChallenges.values()]
      .filter((challenge) =>
        challenge.adminUserId === input.adminUserId
        && challenge.otpHash === input.otpHash
        && challenge.consumedAt === null
        && new Date(challenge.expiresAt).getTime() > nowMs,
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!matchingChallenge) {
      return false;
    }

    this.adminOtpChallenges.set(matchingChallenge.id, {
      ...matchingChallenge,
      consumedAt: input.now,
    });
    return true;
  }

  async createAdminSession(input: {
    adminUserId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
    issuedIpHash: string | null;
    issuedUserAgentHash: string | null;
  }): Promise<void> {
    const session: Omit<AdminSessionRecord, 'admin'> = {
      id: randomUUID(),
      adminUserId: input.adminUserId,
      tokenHash: input.tokenHash,
      createdAt: input.createdAt,
      expiresAt: input.expiresAt,
      revokedAt: null,
      issuedIpHash: input.issuedIpHash,
      issuedUserAgentHash: input.issuedUserAgentHash,
    };
    this.adminSessionsByTokenHash.set(input.tokenHash, session);
  }

  async getActiveAdminSessionByTokenHash(input: {
    tokenHash: string;
    now: string;
  }): Promise<AdminSessionRecord | null> {
    const session = this.adminSessionsByTokenHash.get(input.tokenHash);
    if (!session || session.revokedAt !== null) {
      return null;
    }

    if (new Date(session.expiresAt).getTime() <= new Date(input.now).getTime()) {
      return null;
    }

    const admin = this.adminUsersById.get(session.adminUserId);
    if (!admin) {
      return null;
    }

    return {
      ...session,
      admin,
    };
  }

  async listFeedbackSubmissions(limit: number): Promise<AdminFeedbackEntry[]> {
    return [...this.feedbackBySessionId.values()]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map((entry) => ({
        feedbackId: entry.id,
        sessionId: entry.payload.sessionId,
        rating: entry.payload.rating,
        feedback: entry.payload.feedback,
        mode: entry.payload.mode,
        difficulty: entry.payload.difficulty,
        wave: entry.payload.wave,
        score: entry.payload.score,
        durationMs: entry.payload.durationMs,
        inputMode: entry.payload.inputMode,
        riskFlags: entry.payload.riskFlags,
        createdAt: entry.createdAt,
      }));
  }
}
