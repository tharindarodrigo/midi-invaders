import { PrismaClient } from '@prisma/client';
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
  AdminOtpChallengeRecord,
  AdminSessionRecord,
  FeedbackSubmissionCreateInput,
  FeedbackTokenRecord,
  SessionRecord,
} from '@/lib/types';

export class PrismaRepository implements ApiRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createSession(input: GameSessionStartRequest): Promise<SessionRecord> {
    const created = await this.prisma.gameSession.create({
      data: {
        seed: Math.floor(Math.random() * 1_000_000_000),
        mode: input.mode,
        difficulty: input.difficulty,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      },
    });

    return {
      sessionId: created.id,
      seed: created.seed,
      expiresAt: created.expiresAt.toISOString(),
      mode: created.mode as SessionRecord['mode'],
      difficulty: created.difficulty as SessionRecord['difficulty'],
      createdAt: created.createdAt.toISOString(),
    };
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const session = await this.prisma.gameSession.findUnique({ where: { id: sessionId } });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      seed: session.seed,
      expiresAt: session.expiresAt.toISOString(),
      mode: session.mode as SessionRecord['mode'],
      difficulty: session.difficulty as SessionRecord['difficulty'],
      createdAt: session.createdAt.toISOString(),
    };
  }

  async createScore(input: ScoreSubmitRequest): Promise<ScoreSubmitResponse> {
    const created = await this.prisma.scoreSubmission.create({
      data: {
        sessionId: input.sessionId,
        displayName: input.displayName,
        score: input.score,
        accuracy: input.accuracy,
        durationMs: input.durationMs,
        mode: input.mode,
        difficulty: input.difficulty,
      },
    });

    return {
      ok: true,
      submissionId: created.id,
    };
  }

  async getLeaderboard(input: {
    mode: SessionRecord['mode'];
    difficulty: SessionRecord['difficulty'];
    limit: number;
  }): Promise<LeaderboardEntry[]> {
    const scores = await this.prisma.scoreSubmission.findMany({
      where: {
        mode: input.mode,
        difficulty: input.difficulty,
      },
      orderBy: {
        score: 'desc',
      },
      take: input.limit,
    });

    return scores.map((entry) => ({
      submissionId: entry.id,
      displayName: entry.displayName,
      score: entry.score,
      accuracy: entry.accuracy,
      durationMs: entry.durationMs,
      mode: entry.mode as SessionRecord['mode'],
      difficulty: entry.difficulty as SessionRecord['difficulty'],
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  async upsertFeedbackToken(input: {
    sessionId: string;
    tokenHash: string;
    issuedAt: string;
    expiresAt: string;
    issuedIpHash: string | null;
    issuedUserAgentHash: string | null;
  }): Promise<void> {
    await this.prisma.feedbackToken.upsert({
      where: {
        sessionId: input.sessionId,
      },
      create: {
        sessionId: input.sessionId,
        tokenHash: input.tokenHash,
        issuedAt: new Date(input.issuedAt),
        expiresAt: new Date(input.expiresAt),
        usedAt: null,
        issuedIpHash: input.issuedIpHash,
        issuedUserAgentHash: input.issuedUserAgentHash,
      },
      update: {
        tokenHash: input.tokenHash,
        issuedAt: new Date(input.issuedAt),
        expiresAt: new Date(input.expiresAt),
        usedAt: null,
        issuedIpHash: input.issuedIpHash,
        issuedUserAgentHash: input.issuedUserAgentHash,
      },
    });
  }

  async getFeedbackToken(sessionId: string): Promise<FeedbackTokenRecord | null> {
    const token = await this.prisma.feedbackToken.findUnique({
      where: {
        sessionId,
      },
    });

    if (!token) {
      return null;
    }

    return {
      sessionId: token.sessionId,
      tokenHash: token.tokenHash,
      issuedAt: token.issuedAt.toISOString(),
      expiresAt: token.expiresAt.toISOString(),
      usedAt: token.usedAt ? token.usedAt.toISOString() : null,
    };
  }

  async consumeFeedbackToken(input: {
    sessionId: string;
    tokenHash: string;
    now: string;
  }): Promise<boolean> {
    const nowDate = new Date(input.now);
    const consumed = await this.prisma.feedbackToken.updateMany({
      where: {
        sessionId: input.sessionId,
        tokenHash: input.tokenHash,
        usedAt: null,
        expiresAt: {
          gt: nowDate,
        },
      },
      data: {
        usedAt: nowDate,
      },
    });

    return consumed.count === 1;
  }

  async hasFeedbackSubmission(sessionId: string): Promise<boolean> {
    const count = await this.prisma.feedbackSubmission.count({
      where: {
        sessionId,
      },
    });

    return count > 0;
  }

  async createFeedbackSubmission(input: FeedbackSubmissionCreateInput): Promise<FeedbackSubmitResponse> {
    const created = await this.prisma.feedbackSubmission.create({
      data: {
        sessionId: input.sessionId,
        rating: input.rating,
        feedback: input.feedback,
        mode: input.mode,
        difficulty: input.difficulty,
        wave: input.wave,
        score: input.score,
        durationMs: input.durationMs,
        inputMode: input.inputMode,
        ipHash: input.ipHash,
        userAgentHash: input.userAgentHash,
        riskFlags: input.riskFlags,
      },
    });

    return {
      ok: true,
      feedbackId: created.id,
    };
  }

  async getAdminUserByEmail(email: string): Promise<AdminProfile | null> {
    const admin = await this.prisma.adminUser.findUnique({
      where: {
        email: email.toLowerCase(),
      },
    });
    if (!admin) {
      return null;
    }

    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
    };
  }

  async createAdminOtpChallenge(input: {
    adminUserId: string;
    otpHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<AdminOtpChallengeRecord> {
    const created = await this.prisma.adminOtpChallenge.create({
      data: {
        adminUserId: input.adminUserId,
        otpHash: input.otpHash,
        createdAt: new Date(input.createdAt),
        expiresAt: new Date(input.expiresAt),
        consumedAt: null,
      },
    });

    return {
      id: created.id,
      adminUserId: created.adminUserId,
      otpHash: created.otpHash,
      createdAt: created.createdAt.toISOString(),
      expiresAt: created.expiresAt.toISOString(),
      consumedAt: created.consumedAt ? created.consumedAt.toISOString() : null,
    };
  }

  async consumeAdminOtpChallenge(input: {
    adminUserId: string;
    otpHash: string;
    now: string;
  }): Promise<boolean> {
    const nowDate = new Date(input.now);
    const consumed = await this.prisma.adminOtpChallenge.updateMany({
      where: {
        adminUserId: input.adminUserId,
        otpHash: input.otpHash,
        consumedAt: null,
        expiresAt: {
          gt: nowDate,
        },
      },
      data: {
        consumedAt: nowDate,
      },
    });

    return consumed.count >= 1;
  }

  async createAdminSession(input: {
    adminUserId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
    issuedIpHash: string | null;
    issuedUserAgentHash: string | null;
  }): Promise<void> {
    await this.prisma.adminSession.create({
      data: {
        adminUserId: input.adminUserId,
        tokenHash: input.tokenHash,
        createdAt: new Date(input.createdAt),
        expiresAt: new Date(input.expiresAt),
        revokedAt: null,
        issuedIpHash: input.issuedIpHash,
        issuedUserAgentHash: input.issuedUserAgentHash,
      },
    });
  }

  async getActiveAdminSessionByTokenHash(input: {
    tokenHash: string;
    now: string;
  }): Promise<AdminSessionRecord | null> {
    const session = await this.prisma.adminSession.findUnique({
      where: {
        tokenHash: input.tokenHash,
      },
      include: {
        adminUser: true,
      },
    });

    if (!session || session.revokedAt !== null || session.expiresAt.getTime() <= new Date(input.now).getTime()) {
      return null;
    }

    return {
      id: session.id,
      adminUserId: session.adminUserId,
      tokenHash: session.tokenHash,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: null,
      issuedIpHash: session.issuedIpHash,
      issuedUserAgentHash: session.issuedUserAgentHash,
      admin: {
        id: session.adminUser.id,
        name: session.adminUser.name,
        email: session.adminUser.email,
      },
    };
  }

  async listFeedbackSubmissions(limit: number): Promise<AdminFeedbackEntry[]> {
    const submissions = await this.prisma.feedbackSubmission.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return submissions.map((entry) => ({
      feedbackId: entry.id,
      sessionId: entry.sessionId,
      rating: entry.rating,
      feedback: entry.feedback,
      mode: entry.mode as AdminFeedbackEntry['mode'],
      difficulty: entry.difficulty as AdminFeedbackEntry['difficulty'],
      wave: entry.wave,
      score: entry.score,
      durationMs: entry.durationMs,
      inputMode: entry.inputMode as AdminFeedbackEntry['inputMode'],
      riskFlags: entry.riskFlags,
      createdAt: entry.createdAt.toISOString(),
    }));
  }
}
