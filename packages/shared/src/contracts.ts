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

export const isGameMode = (value: string): value is GameMode =>
  (GAME_MODES as readonly string[]).includes(value);

export const isDifficulty = (value: string): value is Difficulty =>
  (DIFFICULTIES as readonly string[]).includes(value);
