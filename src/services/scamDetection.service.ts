import { nebiusClient, MODELS } from '../config/nebiusClient';
import { logger } from '../config/logger';
import type { ScamAnalysisResult } from '../types';

const SCAM_SYSTEM_PROMPT = `You are a strict security classification engine for GramGyan, an Indian rural student education platform.

Your ONLY task: analyse the provided text (a URL, job vacancy listing, or message body) and determine if it is a scam.

Return ONLY valid JSON in this exact schema — no markdown, no explanation outside the JSON:
{"is_scam": boolean, "confidence_score": float, "flags": string[]}

Rules:
- confidence_score must be a float between 0.0 and 1.0
- flags array must only contain values from: ["MLM_STRUCTURE", "PHISHING_TEMPLATE", "UPFRONT_PAYMENT_DEMAND", "SUSPICIOUS_URL", "FAKE_JOB_LISTING", "DATA_HARVESTING", "IMPERSONATION", "CRYPTOCURRENCY_SCAM"]
- If is_scam is false, flags must be an empty array []
- You MUST detect: multi-level marketing (MLM) recruitment chains, phishing page templates, requests for registration fees or upfront payments, fake government job scams targeting rural youth, and brand impersonation of legitimate Indian companies`;

/**
 * Runs a scam analysis using Qwen3-30B via Nebius Token Factory.
 * Returns a strongly-typed ScamAnalysisResult.
 *
 * NOTE: This function is intended to be called inside a Bull background worker,
 * fully decoupled from the student's live HTTP connection thread.
 */
export async function analyzeForScam(payload: string): Promise<ScamAnalysisResult> {
  const start = Date.now();

  try {
    const completion = await nebiusClient.chat.completions.create({
      model: MODELS.SCAM_DETECTION,
      messages: [
        { role: 'system', content: SCAM_SYSTEM_PROMPT },
        { role: 'user',   content: `Analyse this content:\n\n${payload}` },
      ],
      max_tokens: 256,
      temperature: 0.0,  // Deterministic for safety-critical classifications
      response_format: { type: 'json_object' },
      stream: false,
    });

    const raw     = completion.choices[0]?.message?.content ?? '{}';
    const latency = Date.now() - start;

    logger.info('Scam analysis complete', {
      latency_ms: latency,
      tokens: completion.usage?.total_tokens,
      model: MODELS.SCAM_DETECTION,
    });

    const parsed = JSON.parse(raw) as ScamAnalysisResult;

    // Validate structure before returning
    if (typeof parsed.is_scam !== 'boolean' || typeof parsed.confidence_score !== 'number') {
      throw new Error(`Invalid scam response structure: ${raw}`);
    }

    return {
      is_scam:          parsed.is_scam,
      confidence_score: Math.min(1, Math.max(0, parsed.confidence_score)), // clamp
      flags:            Array.isArray(parsed.flags) ? parsed.flags : [],
    };
  } catch (err) {
    logger.error('Scam detection service error', { error: (err as Error).message });
    // Fail-safe: treat as suspicious on analysis error
    return { is_scam: true, confidence_score: 0.5, flags: ['ANALYSIS_ERROR'] };
  }
}
