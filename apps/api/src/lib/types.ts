import type {
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
}
