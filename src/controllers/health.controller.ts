import { Request, Response, NextFunction } from 'express';
import { checkDatabaseHealth } from '../config/database';
import { checkRedisHealth } from '../config/redis';
import { logger } from '../config/logger';
import type { HealthCheckResult } from '../types';

const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';

export async function healthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const memUsed_mb = process.memoryUsage().heapUsed / 1024 / 1024;
    const memThreshold_mb = parseInt(process.env.HEALTH_MEMORY_THRESHOLD_MB || '512', 10);
    const latencyThreshold_ms = parseInt(process.env.HEALTH_LATENCY_THRESHOLD_MS || '200', 10);

    // ── Parallel infra checks ─────────────────────────────────────────────
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);

    const memStatus  = memUsed_mb < memThreshold_mb ? 'healthy' : 'unhealthy';
    const dbStatus   = dbHealth.status;
    const redisStatus = redisHealth.status;

    const allHealthy = dbStatus === 'healthy'
      && redisStatus === 'healthy'
      && memStatus === 'healthy'
      && dbHealth.latency_ms < latencyThreshold_ms;

    const overallStatus: HealthCheckResult['status'] = allHealthy
      ? 'healthy'
      : (dbStatus === 'unhealthy' || redisStatus === 'unhealthy' ? 'unhealthy' : 'degraded');

    const payload: HealthCheckResult = {
      status:    overallStatus,
      version:   SERVICE_VERSION,
      timestamp: new Date().toISOString(),
      uptime_s:  Math.floor(process.uptime()),
      services: {
        database: {
          status:     dbHealth.status,
          latency_ms: dbHealth.latency_ms,
          pool_total: dbHealth.pool_total,
          pool_idle:  dbHealth.pool_idle,
        },
        redis: {
          status:     redisHealth.status,
          latency_ms: redisHealth.latency_ms,
        },
        memory: {
          status:        memStatus,
          used_mb:       Math.round(memUsed_mb * 100) / 100,
          threshold_mb:  memThreshold_mb,
        },
      },
    };

    const httpStatus = overallStatus === 'healthy' ? 200 : 503;

    logger.debug('Health check completed', { status: overallStatus, db_latency: dbHealth.latency_ms });
    res.status(httpStatus).json(payload);
  } catch (err) {
    next(err);
  }
}
