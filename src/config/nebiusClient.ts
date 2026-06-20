import OpenAI from 'openai';
import { logger } from './logger';

/**
 * Nebius Token Factory — OpenAI-compatible client.
 *
 * Drop-in replacement: same SDK, just a different base_url + key.
 * Python equivalent:
 *   client = OpenAI(base_url="https://api.tokenfactory.nebius.com/v1/", api_key=NEBIUS_API_KEY)
 */
export const nebiusClient = new OpenAI({
  baseURL: process.env.NEBIUS_API_BASE_URL || 'https://api.tokenfactory.nebius.com/v1/',
  apiKey: process.env.NEBIUS_API_KEY || '',
  timeout: 120_000,   // 120 s — generous for vision/STEM models
  maxRetries: 2,
});

/** Typed model registry pulled from environment so swaps never touch code. */
export const MODELS = {
  STANDARD_DIALOGUE: process.env.MODEL_STANDARD_DIALOGUE  || 'nvidia/Nemotron-3-Nano-Omni',
  PROJECT_GUIDANCE:  process.env.MODEL_PROJECT_GUIDANCE   || 'nvidia/Nemotron-3-Ultra-550b-a55b',
  STEM_REASONING:    process.env.MODEL_STEM_REASONING     || 'Qwen/Qwen3-Next-80B-A3B',
  VISION_OCR:        process.env.MODEL_VISION_OCR         || 'Qwen/Qwen2.5-VL-72B-Instruct',
  SCAM_DETECTION:    process.env.MODEL_SCAM_DETECTION     || 'Qwen/Qwen3-30B-A3B-Instruct-2507',
} as const;

export type ModelKey = keyof typeof MODELS;

/** Lightweight client health-check — pings /models list. */
export async function pingNebiusClient(): Promise<boolean> {
  try {
    await nebiusClient.models.list();
    logger.info('Nebius Token Factory client — OK');
    return true;
  } catch (err) {
    logger.warn('Nebius Token Factory ping failed (non-fatal)', { error: (err as Error).message });
    return false;
  }
}
