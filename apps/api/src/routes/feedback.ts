import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  parseFeedbackSubmitInput,
  parseFeedbackTokenIssueInput,
} from '@/lib/validation';

const FEEDBACK_TOKEN_TTL_MS = 1000 * 60 * 20;
const MIN_FEEDBACK_TOKEN_AGE_MS = 1000 * 8;
const MAX_FEEDBACK_LENGTH = 1200;
const TOKEN_RATE_LIMIT_WINDOW_MS = 1000 * 60 * 10;
const TOKEN_RATE_LIMIT_MAX = 10;
const SUBMIT_RATE_LIMIT_WINDOW_MS = 1000 * 60 * 10;
const SUBMIT_RATE_LIMIT_MAX = 8;
const SUBMIT_UA_RATE_LIMIT_MAX = 5;

const urlPattern = /(https?:\/\/|www\.)/i;

const hashValue = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

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

const tokenRateLimiter = new FixedWindowRateLimiter();
const submitRateLimiter = new FixedWindowRateLimiter();

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

export const registerFeedbackRoutes = async (app: FastifyInstance) => {
  app.post('/feedback/token', async (request, reply) => {
    const payload = parseFeedbackTokenIssueInput(request.body);
    if (!payload) {
      return reply.status(400).send({ message: 'Invalid feedback token payload.' });
    }

    const ipKey = request.ip || 'unknown';
    if (!tokenRateLimiter.allow(`feedback-token:${ipKey}`, TOKEN_RATE_LIMIT_MAX, TOKEN_RATE_LIMIT_WINDOW_MS)) {
      return reply.status(429).send({ message: 'Too many feedback token requests. Please try again later.' });
    }

    const session = await app.repository.getSession(payload.sessionId);
    if (!session) {
      return reply.status(404).send({ message: 'Session not found.' });
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return reply.status(410).send({ message: 'Session expired.' });
    }

    const existingFeedback = await app.repository.hasFeedbackSubmission(payload.sessionId);
    if (existingFeedback) {
      return reply.status(409).send({ message: 'Feedback already submitted for this session.' });
    }

    const token = randomBytes(24).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + FEEDBACK_TOKEN_TTL_MS);
    const userAgent = readUserAgent(app, request.headers['user-agent']);
    await app.repository.upsertFeedbackToken({
      sessionId: payload.sessionId,
      tokenHash: hashValue(token),
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      issuedIpHash: hashValue(ipKey),
      issuedUserAgentHash: userAgent ? hashValue(userAgent) : null,
    });

    return {
      token,
      expiresAt: expiresAt.toISOString(),
    };
  });

  app.post('/feedback/submit', async (request, reply) => {
    const payload = parseFeedbackSubmitInput(request.body);
    if (!payload) {
      return reply.status(400).send({ message: 'Invalid feedback submission payload.' });
    }

    if (payload.honeypot && payload.honeypot.length > 0) {
      return reply.status(400).send({ message: 'Invalid feedback submission payload.' });
    }

    if (payload.feedback.length > MAX_FEEDBACK_LENGTH) {
      return reply.status(400).send({ message: `Feedback must be ${MAX_FEEDBACK_LENGTH} characters or fewer.` });
    }

    const ipKey = request.ip || 'unknown';
    const userAgent = readUserAgent(app, request.headers['user-agent']);
    if (!submitRateLimiter.allow(`feedback-submit-ip:${ipKey}`, SUBMIT_RATE_LIMIT_MAX, SUBMIT_RATE_LIMIT_WINDOW_MS)) {
      return reply.status(429).send({ message: 'Too many feedback submissions. Please try again later.' });
    }
    if (
      userAgent
      && !submitRateLimiter.allow(
        `feedback-submit-ua:${hashValue(userAgent)}`,
        SUBMIT_UA_RATE_LIMIT_MAX,
        SUBMIT_RATE_LIMIT_WINDOW_MS,
      )
    ) {
      return reply.status(429).send({ message: 'Too many feedback submissions. Please try again later.' });
    }

    const session = await app.repository.getSession(payload.sessionId);
    if (!session) {
      return reply.status(404).send({ message: 'Session not found.' });
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return reply.status(410).send({ message: 'Session expired.' });
    }

    const feedbackExists = await app.repository.hasFeedbackSubmission(payload.sessionId);
    if (feedbackExists) {
      return reply.status(409).send({ message: 'Feedback already submitted for this session.' });
    }

    const tokenRecord = await app.repository.getFeedbackToken(payload.sessionId);
    if (!tokenRecord) {
      return reply.status(403).send({ message: 'Feedback token missing or invalid.' });
    }

    const now = Date.now();
    const issuedAtMs = new Date(tokenRecord.issuedAt).getTime();
    if (now - issuedAtMs < MIN_FEEDBACK_TOKEN_AGE_MS) {
      return reply.status(429).send({ message: 'Please spend a bit more time playing before submitting feedback.' });
    }

    const nowIso = new Date(now).toISOString();
    const consumed = await app.repository.consumeFeedbackToken({
      sessionId: payload.sessionId,
      tokenHash: hashValue(payload.token),
      now: nowIso,
    });

    if (!consumed) {
      return reply.status(403).send({ message: 'Feedback token missing or invalid.' });
    }

    const riskFlags: string[] = [];
    if (payload.feedback.length > 0 && payload.feedback.length < 12) {
      riskFlags.push('very_short_feedback');
    }
    if (urlPattern.test(payload.feedback)) {
      riskFlags.push('contains_url');
    }

    try {
      const result = await app.repository.createFeedbackSubmission({
        sessionId: payload.sessionId,
        rating: payload.rating,
        feedback: payload.feedback,
        mode: payload.mode,
        difficulty: payload.difficulty,
        wave: payload.wave,
        score: payload.score,
        durationMs: payload.durationMs,
        inputMode: payload.inputMode,
        ipHash: hashValue(ipKey),
        userAgentHash: userAgent ? hashValue(userAgent) : null,
        riskFlags,
      });

      return result;
    } catch (error) {
      if (error instanceof Error && error.message === 'feedback_already_submitted') {
        return reply.status(409).send({ message: 'Feedback already submitted for this session.' });
      }

      throw error;
    }
  });
};
