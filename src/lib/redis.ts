import Redis from "ioredis"; import { env } from "../config/env.config"; export const redis = new Redis(env.REDIS_URL);
