import 'dotenv/config';
import app from './app';
import { logger } from './config/logger';
import { connectPostgres, pgPool } from './config/database';
import { connectRedis, redisClient } from './config/redis';
import { scamDetectionQueue } from './workers/scamDetectionWorker';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function bootstrap(): Promise<void> {
  try {
    // ── Connect infrastructure ──────────────────────────────────────────────
    await connectPostgres();
    await connectRedis();

    // ── Start HTTP server ───────────────────────────────────────────────────
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 GramGyan API running on port ${PORT} [${process.env.NODE_ENV}]`);
      logger.info(`📡 Health check: http://localhost:${PORT}/api/health`);
    });

    // ── Graceful shutdown ───────────────────────────────────────────────────
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`Received ${signal}. Starting graceful shutdown…`);
      server.close(async () => {
        try {
          await pgPool.end();
          await redisClient.quit();
          await scamDetectionQueue.close();
          logger.info('All connections closed. Exiting cleanly.');
          process.exit(0);
        } catch (err) {
          logger.error('Error during shutdown', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled Rejection', reason);
    });

    process.on('uncaughtException', (err: Error) => {
      logger.error('Uncaught Exception', err);
      process.exit(1);
    });
  } catch (err) {
    logger.error('Failed to bootstrap server', err);
    process.exit(1);
  }
}

bootstrap();
