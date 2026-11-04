import { env } from './env.config';

export const redisConfig = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: 3,
};