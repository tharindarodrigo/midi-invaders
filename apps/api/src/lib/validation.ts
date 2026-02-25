import {
  type AdminAuthRequestOtpRequest,
  type AdminAuthVerifyOtpRequest,
  isFeedbackDifficultyLevel,
  isFeedbackGameplayMode,
  isFeedbackInputMode,
  isDifficulty,
  isGameMode,
  type Difficulty,
  type FeedbackSubmitRequest,
  type FeedbackTokenIssueRequest,
  type GameMode,
  type GameSessionStartRequest,
  type ScoreSubmitRequest,
} from '@midi-invaders/shared';

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isFeedbackRating = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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

export const parseFeedbackTokenIssueInput = (payload: unknown): FeedbackTokenIssueRequest | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const maybe = payload as Record<string, unknown>;
  if (typeof maybe.sessionId !== 'string') {
    return null;
  }

  return {
    sessionId: maybe.sessionId,
  };
};

export const parseFeedbackSubmitInput = (payload: unknown): FeedbackSubmitRequest | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const maybe = payload as Record<string, unknown>;
  if (
    typeof maybe.sessionId !== 'string'
    || typeof maybe.token !== 'string'
    || !isFeedbackRating(maybe.rating)
    || typeof maybe.feedback !== 'string'
    || typeof maybe.mode !== 'string'
    || typeof maybe.inputMode !== 'string'
    || typeof maybe.difficulty !== 'number'
    || !isPositiveInteger(maybe.wave)
    || !isPositiveInteger(maybe.score)
    || !isPositiveInteger(maybe.durationMs)
  ) {
    return null;
  }

  if (
    !isFeedbackGameplayMode(maybe.mode)
    || !isFeedbackInputMode(maybe.inputMode)
    || !isFeedbackDifficultyLevel(maybe.difficulty)
  ) {
    return null;
  }

  if (typeof maybe.honeypot !== 'undefined' && typeof maybe.honeypot !== 'string') {
    return null;
  }

  return {
    sessionId: maybe.sessionId,
    token: maybe.token,
    rating: maybe.rating,
    feedback: maybe.feedback.trim(),
    honeypot: maybe.honeypot?.trim(),
    mode: maybe.mode,
    difficulty: maybe.difficulty,
    wave: maybe.wave,
    score: maybe.score,
    durationMs: maybe.durationMs,
    inputMode: maybe.inputMode,
  };
};

export const parseAdminAuthRequestOtpInput = (payload: unknown): AdminAuthRequestOtpRequest | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const maybe = payload as Record<string, unknown>;
  if (typeof maybe.email !== 'string') {
    return null;
  }

  const normalizedEmail = maybe.email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    return null;
  }

  return {
    email: normalizedEmail,
  };
};

export const parseAdminAuthVerifyOtpInput = (payload: unknown): AdminAuthVerifyOtpRequest | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const maybe = payload as Record<string, unknown>;
  if (typeof maybe.email !== 'string' || typeof maybe.otp !== 'string') {
    return null;
  }

  const normalizedEmail = maybe.email.trim().toLowerCase();
  const otp = maybe.otp.trim();
  if (!isValidEmail(normalizedEmail) || !/^\d{6}$/.test(otp)) {
    return null;
  }

  return {
    email: normalizedEmail,
    otp,
  };
};
