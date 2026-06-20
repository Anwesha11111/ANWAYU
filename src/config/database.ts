import { Pool, PoolClient } from 'pg';
import { logger } from './logger';

export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DB_POOL_MIN || '2', 10),
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pgPool.on('error', (err: Error) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

export async function connectPostgres(): Promise<void> {
  const client: PoolClient = await pgPool.connect();
  try {
    const result = await client.query('SELECT NOW() AS now, version() AS version');
    logger.info('PostgreSQL connected', {
      timestamp: result.rows[0].now,
      version: result.rows[0].version.split(' ').slice(0, 2).join(' '),
    });
  } finally {
    client.release();
  }
}

export async function runQuery<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const start = Date.now();
  const result = await pgPool.query(text, params);
  const duration = Date.now() - start;
  logger.debug('DB query executed', { duration_ms: duration, rows: result.rowCount });
  return result.rows as T[];
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  latency_ms: number;
  pool_total: number;
  pool_idle: number;
  pool_waiting: number;
}> {
  const start = Date.now();
  try {
    await runQuery('SELECT 1');
    return {
      status: 'healthy',
      latency_ms: Date.now() - start,
      pool_total: pgPool.totalCount,
      pool_idle: pgPool.idleCount,
      pool_waiting: pgPool.waitingCount,
    };
  } catch {
    return {
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      pool_total: pgPool.totalCount,
      pool_idle: pgPool.idleCount,
      pool_waiting: pgPool.waitingCount,
    };
  }
}
