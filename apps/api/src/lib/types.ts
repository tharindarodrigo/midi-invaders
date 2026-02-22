import type {
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
}
