import type {
  FeedbackSubmitRequest,
  FeedbackSubmitResponse,
  FeedbackTokenIssueResponse,
  GameSessionStartRequest,
  GameSessionStartResponse,
} from '@midi-invaders/shared';
import type { DifficultyLevel, GameMode, GameplaySettings } from '@/types/gameplay';

const DEFAULT_API_BASE_URL = '/api';

const resolveApiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (typeof configured !== 'string' || configured.trim().length === 0) {
    return DEFAULT_API_BASE_URL;
  }

  return configured.replace(/\/+$/, '');
};

const API_BASE_URL = resolveApiBaseUrl();

const mapSessionMode = (mode: GameMode): GameSessionStartRequest['mode'] =>
  mode === 'practice' ? 'practice' : 'classic';

const mapSessionDifficulty = (difficulty: DifficultyLevel): GameSessionStartRequest['difficulty'] => {
  if (difficulty === 3) {
    return 'hard';
  }

  if (difficulty === 2) {
    return 'medium';
  }

  return 'easy';
};

const parseErrorMessage = (payload: unknown): string | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const maybe = payload as Record<string, unknown>;
  return typeof maybe.message === 'string' ? maybe.message : null;
};

const requestJson = async <TResponse>(path: string, body: unknown): Promise<TResponse> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = parseErrorMessage(payload) ?? `Request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload as TResponse;
};

export const createSessionForGameplay = async (
  settings: GameplaySettings,
): Promise<GameSessionStartResponse> =>
  requestJson<GameSessionStartResponse>('/sessions/start', {
    mode: mapSessionMode(settings.mode),
    difficulty: mapSessionDifficulty(settings.difficulty),
  });

export const issueFeedbackToken = async (sessionId: string): Promise<FeedbackTokenIssueResponse> =>
  requestJson<FeedbackTokenIssueResponse>('/feedback/token', { sessionId });

export const submitFeedback = async (payload: FeedbackSubmitRequest): Promise<FeedbackSubmitResponse> =>
  requestJson<FeedbackSubmitResponse>('/feedback/submit', payload);
