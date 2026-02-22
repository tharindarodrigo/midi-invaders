import { PrismaClient } from '@prisma/client';
import type {
  GameSessionStartRequest,
  LeaderboardEntry,
  ScoreSubmitRequest,
  ScoreSubmitResponse,
} from '@midi-invaders/shared';
import type { ApiRepository, SessionRecord } from '@/lib/types';

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
}
