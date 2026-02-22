import 'dotenv/config';
import { buildApp } from '@/app';

const start = async () => {
  const app = await buildApp();

  try {
    await app.listen({ host: '0.0.0.0', port: 3001 });
    app.log.info('API listening on http://localhost:3001');
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
