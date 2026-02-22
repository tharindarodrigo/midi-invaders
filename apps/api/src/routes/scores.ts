import type { FastifyInstance } from 'fastify';
import { parseScoreSubmitInput } from '@/lib/validation';

export const registerScoreRoutes = async (app: FastifyInstance) => {
  app.post('/scores/submit', async (request, reply) => {
    const payload = parseScoreSubmitInput(request.body);
    if (!payload) {
      return reply.status(400).send({ message: 'Invalid score submission payload.' });
    }

    const session = await app.repository.getSession(payload.sessionId);
    if (!session) {
      return reply.status(404).send({ message: 'Session not found.' });
    }

    const result = await app.repository.createScore(payload);
    return result;
  });
};
