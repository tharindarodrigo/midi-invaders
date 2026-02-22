import fp from 'fastify-plugin';
import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import type { ApiRepository } from '@/lib/types';
import { InMemoryRepository } from '@/lib/inMemoryRepository';
import { PrismaRepository } from '@/lib/prismaRepository';

declare module 'fastify' {
  interface FastifyInstance {
    repository: ApiRepository;
  }
}

export const repositoryPlugin = fp(async (app: FastifyInstance) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    app.log.warn('DATABASE_URL missing. Using in-memory repository.');
    app.decorate('repository', new InMemoryRepository());
    return;
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await prisma.$connect();

  app.decorate('repository', new PrismaRepository(prisma));

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
});
