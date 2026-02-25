import type {
  AdminFeedbackEntry,
  AdminProfile,
  FeedbackSubmitRequest,
  FeedbackSubmitResponse,
  Difficulty,
  GameMode,
  GameSessionStartRequest,
  GameSessionStartResponse,
  LeaderboardEntry,
  ScoreSubmitRequest,
  ScoreSubmitResponse,
} from '@midi-invaders/shared';

export interface SessionRecord extends GameSessionStartResponse {
  mode: GameMode;
  difficulty: Difficulty;
  createdAt: string;
}

export interface FeedbackTokenRecord {
  sessionId: string;
  tokenHash: string;
  issuedAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface FeedbackSubmissionCreateInput {
  sessionId: string;
  rating: FeedbackSubmitRequest['rating'];
  feedback: FeedbackSubmitRequest['feedback'];
  mode: FeedbackSubmitRequest['mode'];
  difficulty: FeedbackSubmitRequest['difficulty'];
  wave: FeedbackSubmitRequest['wave'];
  score: FeedbackSubmitRequest['score'];
  durationMs: FeedbackSubmitRequest['durationMs'];
  inputMode: FeedbackSubmitRequest['inputMode'];
  ipHash: string | null;
  userAgentHash: string | null;
  riskFlags: string[];
}

export interface AdminOtpChallengeRecord {
  id: string;
  adminUserId: string;
  otpHash: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

export interface AdminSessionRecord {
  id: string;
  adminUserId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  issuedIpHash: string | null;
  issuedUserAgentHash: string | null;
  admin: AdminProfile;
}

export interface ApiRepository {
  createSession(input: GameSessionStartRequest): Promise<SessionRecord>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  createScore(input: ScoreSubmitRequest): Promise<ScoreSubmitResponse>;
  getLeaderboard(input: {
    mode: GameMode;
    difficulty: Difficulty;
    limit: number;
  }): Promise<LeaderboardEntry[]>;
  upsertFeedbackToken(input: {
    sessionId: string;
    tokenHash: string;
    issuedAt: string;
    expiresAt: string;
    issuedIpHash: string | null;
    issuedUserAgentHash: string | null;
  }): Promise<void>;
  getFeedbackToken(sessionId: string): Promise<FeedbackTokenRecord | null>;
  consumeFeedbackToken(input: {
    sessionId: string;
    tokenHash: string;
    now: string;
  }): Promise<boolean>;
  hasFeedbackSubmission(sessionId: string): Promise<boolean>;
  createFeedbackSubmission(input: FeedbackSubmissionCreateInput): Promise<FeedbackSubmitResponse>;
  getAdminUserByEmail(email: string): Promise<AdminProfile | null>;
  createAdminOtpChallenge(input: {
    adminUserId: string;
    otpHash: string;
    createdAt: string;
    expiresAt: string;
  }): Promise<AdminOtpChallengeRecord>;
  consumeAdminOtpChallenge(input: {
    adminUserId: string;
    otpHash: string;
    now: string;
  }): Promise<boolean>;
  createAdminSession(input: {
    adminUserId: string;
    tokenHash: string;
    createdAt: string;
    expiresAt: string;
    issuedIpHash: string | null;
    issuedUserAgentHash: string | null;
  }): Promise<void>;
  getActiveAdminSessionByTokenHash(input: {
    tokenHash: string;
    now: string;
  }): Promise<AdminSessionRecord | null>;
  listFeedbackSubmissions(limit: number): Promise<AdminFeedbackEntry[]>;
}
