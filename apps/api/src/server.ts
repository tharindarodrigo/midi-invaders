import 'dotenv/config';
import { buildApp } from '@/app';

const resolvePort = (): number => {
  const rawPort = process.env.PORT;
  if (!rawPort) {
    return 3101;
  }

  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  return parsed;
};

const start = async () => {
  const app = await buildApp();
  const host = process.env.HOST ?? '0.0.0.0';
  const port = resolvePort();

  try {
    await app.listen({ host, port });
    app.log.info(`API listening on http://${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
