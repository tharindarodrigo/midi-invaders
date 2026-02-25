import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { sendAdminOtpEmail } from '@/lib/adminOtpMailer';
import {
  parseAdminAuthRequestOtpInput,
  parseAdminAuthVerifyOtpInput,
} from '@/lib/validation';

const OTP_LENGTH = 6;
const OTP_TTL_MS = 1000 * 60 * 10;
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const OTP_REQUEST_RATE_LIMIT_MAX = 8;
const OTP_REQUEST_RATE_LIMIT_WINDOW_MS = 1000 * 60 * 10;
const OTP_VERIFY_RATE_LIMIT_MAX = 20;
const OTP_VERIFY_RATE_LIMIT_WINDOW_MS = 1000 * 60 * 10;
const FEEDBACK_LIST_DEFAULT_LIMIT = 100;
const FEEDBACK_LIST_MAX_LIMIT = 300;

const hashValue = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

const generateOtp = (): string =>
  randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');

class FixedWindowRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAtMs: number }>();

  allow(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const active = this.windows.get(key);
    if (!active || now >= active.resetAtMs) {
      this.windows.set(key, { count: 1, resetAtMs: now + windowMs });
      return true;
    }

    if (active.count >= max) {
      return false;
    }

    active.count += 1;
    this.windows.set(key, active);
    return true;
  }
}

const otpRequestRateLimiter = new FixedWindowRateLimiter();
const otpVerifyRateLimiter = new FixedWindowRateLimiter();

const readUserAgent = (app: FastifyInstance, rawUserAgent: unknown): string => {
  if (typeof rawUserAgent === 'string') {
    return rawUserAgent;
  }

  if (Array.isArray(rawUserAgent)) {
    return rawUserAgent.join(', ');
  }

  app.log.warn('Unexpected user-agent header shape.');
  return '';
};

const readAuthHeader = (rawAuthHeader: unknown): string | null => {
  if (typeof rawAuthHeader === 'string') {
    return rawAuthHeader;
  }

  if (Array.isArray(rawAuthHeader) && typeof rawAuthHeader[0] === 'string') {
    return rawAuthHeader[0];
  }

  return null;
};

const readBearerToken = (rawAuthHeader: unknown): string | null => {
  const authHeader = readAuthHeader(rawAuthHeader);
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.trim().split(/\s+/u);
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
};

const parseFeedbackLimit = (query: unknown): number | null => {
  if (typeof query !== 'object' || query === null) {
    return FEEDBACK_LIST_DEFAULT_LIMIT;
  }

  const maybe = query as Record<string, unknown>;
  if (typeof maybe.limit === 'undefined') {
    return FEEDBACK_LIST_DEFAULT_LIMIT;
  }

  const parsed = Number(maybe.limit);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > FEEDBACK_LIST_MAX_LIMIT) {
    return null;
  }

  return parsed;
};

export const registerAdminRoutes = async (app: FastifyInstance) => {
  app.post('/admin/auth/request-otp', async (request, reply) => {
    const payload = parseAdminAuthRequestOtpInput(request.body);
    if (!payload) {
      return reply.status(400).send({ message: 'Invalid OTP request payload.' });
    }

    const ipKey = request.ip || 'unknown';
    if (!otpRequestRateLimiter.allow(`admin-otp-ip:${ipKey}`, OTP_REQUEST_RATE_LIMIT_MAX, OTP_REQUEST_RATE_LIMIT_WINDOW_MS)) {
      return reply.status(429).send({ message: 'Too many OTP requests. Please try again later.' });
    }
    if (!otpRequestRateLimiter.allow(`admin-otp-email:${payload.email}`, OTP_REQUEST_RATE_LIMIT_MAX, OTP_REQUEST_RATE_LIMIT_WINDOW_MS)) {
      return reply.status(429).send({ message: 'Too many OTP requests. Please try again later.' });
    }

    const admin = await app.repository.getAdminUserByEmail(payload.email);
    if (!admin) {
      return reply.status(404).send({ message: 'Admin account not found.' });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    const otp = generateOtp();

    await app.repository.createAdminOtpChallenge({
      adminUserId: admin.id,
      otpHash: hashValue(otp),
      createdAt: nowIso,
      expiresAt: expiresAt.toISOString(),
    });

    try {
      await sendAdminOtpEmail({
        toName: admin.name,
        toEmail: admin.email,
        otp,
        expiresAt,
      });
    } catch (error) {
      app.log.error(error);
      return reply.status(500).send({
        message: 'Unable to deliver OTP email. Verify ADMIN_SMTP_* settings.',
      });
    }

    return {
      ok: true,
      expiresAt: expiresAt.toISOString(),
    };
  });

  app.post('/admin/auth/verify-otp', async (request, reply) => {
    const payload = parseAdminAuthVerifyOtpInput(request.body);
    if (!payload) {
      return reply.status(400).send({ message: 'Invalid OTP verification payload.' });
    }

    const ipKey = request.ip || 'unknown';
    if (!otpVerifyRateLimiter.allow(`admin-otp-verify-ip:${ipKey}`, OTP_VERIFY_RATE_LIMIT_MAX, OTP_VERIFY_RATE_LIMIT_WINDOW_MS)) {
      return reply.status(429).send({ message: 'Too many OTP verification attempts. Please try again later.' });
    }
    if (!otpVerifyRateLimiter.allow(`admin-otp-verify-email:${payload.email}`, OTP_VERIFY_RATE_LIMIT_MAX, OTP_VERIFY_RATE_LIMIT_WINDOW_MS)) {
      return reply.status(429).send({ message: 'Too many OTP verification attempts. Please try again later.' });
    }

    const admin = await app.repository.getAdminUserByEmail(payload.email);
    if (!admin) {
      return reply.status(401).send({ message: 'Invalid email or OTP.' });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const consumed = await app.repository.consumeAdminOtpChallenge({
      adminUserId: admin.id,
      otpHash: hashValue(payload.otp),
      now: nowIso,
    });

    if (!consumed) {
      return reply.status(401).send({ message: 'Invalid email or OTP.' });
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_MS);
    const userAgent = readUserAgent(app, request.headers['user-agent']);

    await app.repository.createAdminSession({
      adminUserId: admin.id,
      tokenHash: hashValue(token),
      createdAt: nowIso,
      expiresAt: expiresAt.toISOString(),
      issuedIpHash: hashValue(ipKey),
      issuedUserAgentHash: userAgent ? hashValue(userAgent) : null,
    });

    return {
      ok: true,
      token,
      expiresAt: expiresAt.toISOString(),
      admin,
    };
  });

  app.get('/admin/feedback', async (request, reply) => {
    const token = readBearerToken(request.headers.authorization);
    if (!token) {
      return reply.status(401).send({ message: 'Missing or invalid admin authorization token.' });
    }

    const nowIso = new Date().toISOString();
    const activeSession = await app.repository.getActiveAdminSessionByTokenHash({
      tokenHash: hashValue(token),
      now: nowIso,
    });

    if (!activeSession) {
      return reply.status(401).send({ message: 'Admin session expired or invalid.' });
    }

    const limit = parseFeedbackLimit(request.query);
    if (!limit) {
      return reply.status(400).send({
        message: `Invalid limit query. Provide an integer between 1 and ${FEEDBACK_LIST_MAX_LIMIT}.`,
      });
    }

    const entries = await app.repository.listFeedbackSubmissions(limit);
    return {
      entries,
    };
  });
};
