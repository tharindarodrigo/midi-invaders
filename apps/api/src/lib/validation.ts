import {
  isDifficulty,
  isGameMode,
  type Difficulty,
  type GameMode,
  type GameSessionStartRequest,
  type ScoreSubmitRequest,
} from '@midi-invaders/shared';

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export const parseStartSessionInput = (payload: unknown): GameSessionStartRequest | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const maybe = payload as Record<string, unknown>;
  if (typeof maybe.mode !== 'string' || typeof maybe.difficulty !== 'string') {
    return null;
  }

  if (!isGameMode(maybe.mode) || !isDifficulty(maybe.difficulty)) {
    return null;
  }

  return {
    mode: maybe.mode,
    difficulty: maybe.difficulty,
  };
};

export const parseScoreSubmitInput = (payload: unknown): ScoreSubmitRequest | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const maybe = payload as Record<string, unknown>;
  if (
    typeof maybe.sessionId !== 'string' ||
    typeof maybe.displayName !== 'string' ||
    !isPositiveInteger(maybe.score) ||
    typeof maybe.accuracy !== 'number' ||
    !isPositiveInteger(maybe.durationMs) ||
    typeof maybe.mode !== 'string' ||
    typeof maybe.difficulty !== 'string'
  ) {
    return null;
  }

  if (!isGameMode(maybe.mode) || !isDifficulty(maybe.difficulty)) {
    return null;
  }

  return {
    sessionId: maybe.sessionId,
    displayName: maybe.displayName.trim(),
    score: maybe.score,
    accuracy: maybe.accuracy,
    durationMs: maybe.durationMs,
    mode: maybe.mode,
    difficulty: maybe.difficulty,
  };
};

export const parseLeaderboardQuery = (query: unknown): {
  mode: GameMode;
  difficulty: Difficulty;
  limit: number;
} | null => {
  if (typeof query !== 'object' || query === null) {
    return null;
  }

  const maybe = query as Record<string, unknown>;
  if (typeof maybe.mode !== 'string' || typeof maybe.difficulty !== 'string') {
    return null;
  }

  if (!isGameMode(maybe.mode) || !isDifficulty(maybe.difficulty)) {
    return null;
  }

  const parsedLimit = Number(maybe.limit ?? 10);
  const limit = Number.isInteger(parsedLimit) ? parsedLimit : 10;
  if (limit < 1 || limit > 100) {
    return null;
  }

  return {
    mode: maybe.mode,
    difficulty: maybe.difficulty,
    limit,
  };
};
