import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const { REDIS_URL } = process.env;

const redis = REDIS_URL ? new Redis(REDIS_URL, { lazyConnect: true }) : null;

export async function getRedis () {
  if (!redis) throw new Error('Redis not configured');
  if (redis.status === 'wait') {
    await redis.connect();
  }
  return redis;
}

export default redis;
