import type { FastifyInstance } from 'fastify';
import { parseLeaderboardQuery } from '@/lib/validation';

export const registerLeaderboardRoutes = async (app: FastifyInstance) => {
  app.get('/leaderboards', async (request, reply) => {
    const query = parseLeaderboardQuery(request.query);
    if (!query) {
      return reply.status(400).send({ message: 'Invalid leaderboard query.' });
    }

    const entries = await app.repository.getLeaderboard(query);
    return { entries };
  });
};
