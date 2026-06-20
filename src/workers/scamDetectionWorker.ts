import Bull from 'bull';
import { analyzeForScam } from '../services/scamDetection.service';
import { runQuery } from '../config/database';
import { logger } from '../config/logger';

interface ScamJobData {
  log_id: string;       // scam_detection_log primary key
  payload_type: 'link' | 'vacancy' | 'message';
  raw_payload: string;
  submitted_by_user_id?: string;
}

// ── Queue definition (backed by Redis) ───────────────────────────────────────
export const scamDetectionQueue = new Bull<ScamJobData>('scam-detection', {
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,  // Keep last 100 completed jobs
    removeOnFail: 200,
  },
});

// ── Worker (processor) ────────────────────────────────────────────────────────
scamDetectionQueue.process(async (job) => {
  const { log_id, raw_payload } = job.data;

  logger.info('Scam worker processing job', { job_id: job.id, log_id });

  // Mark as processing
  await runQuery(
    `UPDATE scam_detection_log SET status = 'processing' WHERE id = $1`,
    [log_id]
  );

  const start  = Date.now();
  const result = await analyzeForScam(raw_payload);
  const ms     = Date.now() - start;

  // Persist result
  await runQuery(
    `UPDATE scam_detection_log
     SET is_scam = $1, confidence_score = $2, flags = $3,
         analysis_latency_ms = $4, status = 'done', completed_at = NOW()
     WHERE id = $5`,
    [result.is_scam, result.confidence_score, result.flags, ms, log_id]
  );

  logger.info('Scam worker job complete', {
    log_id,
    is_scam: result.is_scam,
    confidence: result.confidence_score,
    latency_ms: ms,
  });

  return result;
});

// ── Queue lifecycle events ────────────────────────────────────────────────────
scamDetectionQueue.on('failed', async (job, err) => {
  logger.error('Scam job failed', { job_id: job.id, log_id: job.data.log_id, error: err.message });
  await runQuery(
    `UPDATE scam_detection_log SET status = 'failed', error_message = $1 WHERE id = $2`,
    [err.message, job.data.log_id]
  );
});

scamDetectionQueue.on('stalled', (job) => {
  logger.warn('Scam job stalled', { job_id: job.id });
});

/**
 * Public helper: enqueue a payload for async scam analysis.
 * Returns the job_id immediately — does NOT block the caller.
 */
export async function enqueueScamCheck(data: Omit<ScamJobData, 'log_id'>): Promise<string> {
  // Insert placeholder row
  const rows = await runQuery<{ id: string }>(
    `INSERT INTO scam_detection_log (payload_type, raw_payload, submitted_by_user_id, status)
     VALUES ($1, $2, $3, 'queued') RETURNING id`,
    [data.payload_type, data.raw_payload, data.submitted_by_user_id ?? null]
  );

  const log_id = rows[0].id;
  const job    = await scamDetectionQueue.add({ ...data, log_id });

  logger.info('Scam check enqueued', { log_id, job_id: job.id });
  return log_id;
}
