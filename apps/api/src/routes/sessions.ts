import type { FastifyInstance } from 'fastify';
import { parseStartSessionInput } from '@/lib/validation';

export const registerSessionRoutes = async (app: FastifyInstance) => {
  app.post('/sessions/start', async (request, reply) => {
    const payload = parseStartSessionInput(request.body);
    if (!payload) {
      return reply.status(400).send({ message: 'Invalid session start payload.' });
    }

    const session = await app.repository.createSession(payload);
    return {
      sessionId: session.sessionId,
      seed: session.seed,
      expiresAt: session.expiresAt,
    };
  });
};
