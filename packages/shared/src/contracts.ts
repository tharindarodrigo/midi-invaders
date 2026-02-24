export const GAME_MODES = ['classic', 'practice'] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface GameSessionStartRequest {
  mode: GameMode;
  difficulty: Difficulty;
}

export interface GameSessionStartResponse {
  sessionId: string;
  seed: number;
  expiresAt: string;
}

export interface ScoreSubmitRequest {
  sessionId: string;
  displayName: string;
  score: number;
  accuracy: number;
  durationMs: number;
  mode: GameMode;
  difficulty: Difficulty;
}

export interface ScoreSubmitResponse {
  ok: true;
  submissionId: string;
}

export interface LeaderboardEntry {
  submissionId: string;
  displayName: string;
  score: number;
  accuracy: number;
  durationMs: number;
  mode: GameMode;
  difficulty: Difficulty;
  createdAt: string;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
}

export const FEEDBACK_GAMEPLAY_MODES = ['arcade', 'practice', 'pitch'] as const;
export type FeedbackGameplayMode = (typeof FEEDBACK_GAMEPLAY_MODES)[number];

export type FeedbackDifficultyLevel = 1 | 2 | 3;

export const FEEDBACK_INPUT_MODES = ['keyboard', 'midi', 'microphone'] as const;
export type FeedbackInputMode = (typeof FEEDBACK_INPUT_MODES)[number];

export interface FeedbackTokenIssueRequest {
  sessionId: string;
}

export interface FeedbackTokenIssueResponse {
  token: string;
  expiresAt: string;
}

export interface FeedbackSubmitRequest {
  sessionId: string;
  token: string;
  rating: number;
  feedback: string;
  honeypot?: string;
  mode: FeedbackGameplayMode;
  difficulty: FeedbackDifficultyLevel;
  wave: number;
  score: number;
  durationMs: number;
  inputMode: FeedbackInputMode;
}

export interface FeedbackSubmitResponse {
  ok: true;
  feedbackId: string;
}

export const isGameMode = (value: string): value is GameMode =>
  (GAME_MODES as readonly string[]).includes(value);

export const isDifficulty = (value: string): value is Difficulty =>
  (DIFFICULTIES as readonly string[]).includes(value);

export const isFeedbackGameplayMode = (value: string): value is FeedbackGameplayMode =>
  (FEEDBACK_GAMEPLAY_MODES as readonly string[]).includes(value);

export const isFeedbackInputMode = (value: string): value is FeedbackInputMode =>
  (FEEDBACK_INPUT_MODES as readonly string[]).includes(value);

export const isFeedbackDifficultyLevel = (value: number): value is FeedbackDifficultyLevel =>
  value === 1 || value === 2 || value === 3;
