import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { ApiRepository } from '@/lib/types';
import { InMemoryRepository } from '@/lib/inMemoryRepository';
import { repositoryPlugin } from '@/plugins/repository';
import { registerHealthRoutes } from '@/routes/health';
import { registerSessionRoutes } from '@/routes/sessions';
import { registerScoreRoutes } from '@/routes/scores';
import { registerLeaderboardRoutes } from '@/routes/leaderboards';

interface BuildAppOptions {
  repository?: ApiRepository;
}

export const buildApp = async (options: BuildAppOptions = {}): Promise<FastifyInstance> => {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });

  if (options.repository) {
    app.decorate('repository', options.repository);
  } else {
    await app.register(repositoryPlugin);
  }

  await app.register(async (router) => {
    await registerHealthRoutes(router);
    await router.register(async (api) => {
      await registerSessionRoutes(api);
      await registerScoreRoutes(api);
      await registerLeaderboardRoutes(api);
    }, { prefix: '/api' });
  });

  return app;
};

export const buildAppForTests = async (): Promise<FastifyInstance> =>
  buildApp({ repository: new InMemoryRepository() });
