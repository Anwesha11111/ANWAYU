import { createClient } from 'redis';
import { logger } from './logger';

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD || undefined,
  socket: {
    tls: process.env.REDIS_TLS === 'true',
    reconnectStrategy: (retries: number) => {
      if (retries > 10) {
        logger.error('Redis reconnect limit reached — giving up');
        return new Error('Redis connection failed after 10 retries');
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

redisClient.on('error', (err: Error) => {
  logger.error('Redis client error', { error: err.message });
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis reconnecting…');
});

export async function connectRedis(): Promise<void> {
  await redisClient.connect();
  const pong = await redisClient.ping();
  logger.info('Redis connected', { pong });
}

export async function checkRedisHealth(): Promise<{ status: 'healthy' | 'unhealthy'; latency_ms: number }> {
  const start = Date.now();
  try {
    await redisClient.ping();
    return { status: 'healthy', latency_ms: Date.now() - start };
  } catch {
    return { status: 'unhealthy', latency_ms: Date.now() - start };
  }
}
