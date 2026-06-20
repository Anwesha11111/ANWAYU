import { Request, Response, NextFunction } from 'express';
import { routeAIQuery, extractSTEMAnswer } from '../services/aiRouter.service';
import { enqueueScamCheck } from '../workers/scamDetectionWorker';
import { apiSuccess, apiError } from '../types';
import { logger } from '../config/logger';
import type { AIQueryRequest } from '../types';

// ─── POST /api/ai/query ───────────────────────────────────────────────────────
export async function handleAIQuery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { mode, messages, image_base64, stream, language, max_tokens } = req.body as AIQueryRequest;

    if (!mode || !messages?.length) {
      res.status(400).json(apiError('INVALID_REQUEST', '`mode` and `messages` are required'));
      return;
    }

    const result = await routeAIQuery({ mode, messages, image_base64, stream, language, max_tokens });

    // For STEM mode: strip <think> blocks from student-facing content
    if (mode === 'stem_reasoning') {
      const { reasoning, answer } = extractSTEMAnswer(result.content);
      result.content = answer;
      (result as typeof result & { chain_of_thought?: string }).chain_of_thought = reasoning;
    }

    res.json(apiSuccess(result));
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/ai/scan-link ───────────────────────────────────────────────────
export async function handleLinkScan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { url, vacancy_text, payload_type = 'link' } = req.body as {
      url?: string;
      vacancy_text?: string;
      payload_type?: 'link' | 'vacancy' | 'message';
    };

    const rawPayload = url || vacancy_text;
    if (!rawPayload) {
      res.status(400).json(apiError('INVALID_REQUEST', 'Provide `url` or `vacancy_text`'));
      return;
    }

    // Fire-and-forget: returns log_id immediately, analysis runs in background
    const log_id = await enqueueScamCheck({
      payload_type,
      raw_payload: rawPayload,
      submitted_by_user_id: (req as Request & { user?: { id: string } }).user?.id,
    });

    logger.info('Scam scan enqueued', { log_id, payload_type });

    res.status(202).json(apiSuccess(
      { log_id, status: 'queued', message: 'Analysis running asynchronously. Poll /api/ai/scan-result/:id for result.' }
    ));
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/ai/scan-result/:id ─────────────────────────────────────────────
export async function getScamResult(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { runQuery } = await import('../config/database');
    const rows = await runQuery<{
      status: string; is_scam: boolean | null; confidence_score: number | null; flags: string[];
    }>(
      'SELECT status, is_scam, confidence_score, flags FROM scam_detection_log WHERE id = $1',
      [req.params.id]
    );

    if (!rows.length) {
      res.status(404).json(apiError('NOT_FOUND', 'Scan result not found'));
      return;
    }

    res.json(apiSuccess(rows[0]));
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/ai/network-config ───────────────────────────────────────────────
export function getNetworkConfig(req: Request, res: Response): void {
  res.json(apiSuccess({
    network_profile: req.networkProfile,
    media_config:    req.mediaConfig,
  }));
}
