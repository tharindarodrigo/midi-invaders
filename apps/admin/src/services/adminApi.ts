import type {
  AdminAuthRequestOtpResponse,
  AdminAuthVerifyOtpRequest,
  AdminAuthVerifyOtpResponse,
  AdminFeedbackListResponse,
} from '@midi-invaders/shared';

const DEFAULT_API_BASE_URL = '/api';

const resolveApiBaseUrl = (): string => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (typeof configured !== 'string' || configured.trim().length === 0) {
    return DEFAULT_API_BASE_URL;
  }

  return configured.replace(/\/+$/, '');
};

const API_BASE_URL = resolveApiBaseUrl();

const parseErrorMessage = (payload: unknown): string | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const maybe = payload as Record<string, unknown>;
  return typeof maybe.message === 'string' ? maybe.message : null;
};

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string;
}

const requestJson = async <TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> => {
  const method = options.method ?? 'POST';
  const headers: Record<string, string> = {};

  if (typeof options.body !== 'undefined') {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: typeof options.body === 'undefined' ? undefined : JSON.stringify(options.body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = parseErrorMessage(payload) ?? `Request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload as TResponse;
};

export const requestAdminOtp = async (email: string): Promise<AdminAuthRequestOtpResponse> =>
  requestJson<AdminAuthRequestOtpResponse>('/admin/auth/request-otp', {
    body: {
      email,
    },
  });

export const verifyAdminOtp = async (
  payload: AdminAuthVerifyOtpRequest,
): Promise<AdminAuthVerifyOtpResponse> =>
  requestJson<AdminAuthVerifyOtpResponse>('/admin/auth/verify-otp', {
    body: payload,
  });

export const fetchAdminFeedback = async (
  token: string,
  limit = 100,
): Promise<AdminFeedbackListResponse> =>
  requestJson<AdminFeedbackListResponse>(`/admin/feedback?limit=${limit}`, {
    method: 'GET',
    token,
  });
