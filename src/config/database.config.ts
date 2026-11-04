import { env } from './env.config';

export const databaseConfig = {
  url: env.DATABASE_URL,
  maxConnections: env.NODE_ENV === 'production' ? 50 : 10,
};