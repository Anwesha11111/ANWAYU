import OpenAI from 'openai';
import { nebiusClient, MODELS } from '../config/nebiusClient';
import { logger } from '../config/logger';
import type { AIQueryRequest, AIQueryResponse, AIRouteMode } from '../types';

// ─── Voice Processing Language Hook Stubs (12 Languages) ────────────────────
// These are called by the standard_dialogue route to attach language metadata.
const SUPPORTED_LANGUAGES: Record<string, string> = {
  en:    'English',
  hi:    'Hindi',
  bn:    'Bengali',
  te:    'Telugu',
  mr:    'Marathi',
  ta:    'Tamil',
  gu:    'Gujarati',
  kn:    'Kannada',
  ml:    'Malayalam',
  pa:    'Punjabi',
  or:    'Odia',
  ur:    'Urdu',
};

function voiceProcessingHook(language: string): void {
  // STUB: Attach TTS/STT pipeline metadata.
  // Replace with actual voice SDK call (e.g., NVIDIA Riva, Azure Speech).
  if (SUPPORTED_LANGUAGES[language]) {
    logger.debug('Voice hook triggered', { language, lang_name: SUPPORTED_LANGUAGES[language] });
  } else {
    logger.warn('Voice hook: unsupported language, defaulting to English', { language });
  }
}

// ─── Route Selection Logic ───────────────────────────────────────────────────
function selectModel(mode: AIRouteMode): string {
  switch (mode) {
    case 'standard_dialogue': return MODELS.STANDARD_DIALOGUE;
    case 'project_guidance':  return MODELS.PROJECT_GUIDANCE;
    case 'stem_reasoning':    return MODELS.STEM_REASONING;
    case 'vision_ocr':        return MODELS.VISION_OCR;
    case 'scam_detection':    return MODELS.SCAM_DETECTION;
    default:
      logger.warn('Unknown AI route mode, falling back to standard dialogue', { mode });
      return MODELS.STANDARD_DIALOGUE;
  }
}

// ─── Route Token Budget ───────────────────────────────────────────────────────
function defaultMaxTokens(mode: AIRouteMode): number {
  switch (mode) {
    case 'standard_dialogue': return 1024;
    case 'project_guidance':  return 4096;
    case 'stem_reasoning':    return 8192;  // STEM needs longer CoT
    case 'vision_ocr':        return 2048;
    case 'scam_detection':    return 256;   // Structured JSON — tight budget
    default: return 1024;
  }
}

// ─── Main Router ─────────────────────────────────────────────────────────────
/**
 * Intelligent AI routing engine.
 * All models are served via Nebius Token Factory (OpenAI-compatible).
 *
 * Route map:
 *  standard_dialogue → Nemotron-3-Nano-Omni        (~90 tok/s)  + voice hooks
 *  project_guidance  → Nemotron-3-Ultra-550b-a55b  (~59 tok/s)  multi-agent
 *  stem_reasoning    → Qwen3-Next-80B-A3B           (~85 tok/s)  CoT math/code
 *  vision_ocr        → Qwen2.5-VL-72B-Instruct      (~20 tok/s)  image OCR
 *  scam_detection    → Qwen3-30B-A3B-Instruct-2507  (~70 tok/s)  structured JSON
 */
export async function routeAIQuery(request: AIQueryRequest): Promise<AIQueryResponse> {
  const modelId  = selectModel(request.mode);
  const maxTok   = request.max_tokens ?? defaultMaxTokens(request.mode);
  const start    = Date.now();

  logger.info('AI router dispatching', { mode: request.mode, model: modelId, max_tokens: maxTok });

  // ── Vision-OCR path — multimodal content ──────────────────────────────────
  if (request.mode === 'vision_ocr') {
    return handleVisionQuery(request, modelId, start, maxTok);
  }

  // ── Voice hook stub (standard dialogue only) ───────────────────────────────
  if (request.mode === 'standard_dialogue' && request.language) {
    voiceProcessingHook(request.language);
  }

  // ── Text-only completion (all other modes) ────────────────────────────────
  try {
    const completion = await nebiusClient.chat.completions.create({
      model: modelId,
      messages: request.messages as OpenAI.Chat.ChatCompletionMessageParam[],
      max_tokens: maxTok,
      temperature: request.mode === 'stem_reasoning' ? 0.2 : 0.7,
      stream: false,
    });

    const choice  = completion.choices[0];
    const usage   = completion.usage;
    const latency = Date.now() - start;

    logger.info('AI router completed', { mode: request.mode, latency_ms: latency, tokens: usage?.total_tokens });

    return {
      model_used:   modelId,
      mode:         request.mode,
      content:      choice.message?.content ?? '',
      tokens_used:  {
        prompt:     usage?.prompt_tokens     ?? 0,
        completion: usage?.completion_tokens ?? 0,
        total:      usage?.total_tokens      ?? 0,
      },
      latency_ms:   latency,
      finish_reason: choice.finish_reason ?? 'stop',
    };
  } catch (err) {
    logger.error('AI router error', { mode: request.mode, model: modelId, error: (err as Error).message });
    throw err;
  }
}

// ─── Vision / OCR Handler ─────────────────────────────────────────────────────
async function handleVisionQuery(
  request: AIQueryRequest,
  modelId: string,
  start: number,
  maxTok: number,
): Promise<AIQueryResponse> {
  if (!request.image_base64) {
    throw new Error('vision_ocr mode requires image_base64 payload');
  }

  // Build OpenAI vision message format
  const visionMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...request.messages.slice(0, -1) as OpenAI.Chat.ChatCompletionMessageParam[],
    {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${request.image_base64}`, detail: 'high' },
        },
        {
          type: 'text',
          text: (request.messages.at(-1)?.content as string) ?? 'Extract all text from this image accurately.',
        },
      ],
    },
  ];

  const completion = await nebiusClient.chat.completions.create({
    model: modelId,
    messages: visionMessages,
    max_tokens: maxTok,
    stream: false,
  });

  const choice  = completion.choices[0];
  const usage   = completion.usage;
  const latency = Date.now() - start;

  logger.info('Vision OCR completed', { latency_ms: latency, tokens: usage?.total_tokens });

  return {
    model_used:   modelId,
    mode:         'vision_ocr',
    content:      choice.message?.content ?? '',
    tokens_used:  {
      prompt:     usage?.prompt_tokens     ?? 0,
      completion: usage?.completion_tokens ?? 0,
      total:      usage?.total_tokens      ?? 0,
    },
    latency_ms:   latency,
    finish_reason: choice.finish_reason ?? 'stop',
  };
}

// ─── STEM CoT Response Extractor ─────────────────────────────────────────────
/**
 * Qwen3 models emit <think>…</think> chain-of-thought blocks.
 * Strip them for student-facing output but log them for analytics.
 */
export function extractSTEMAnswer(rawContent: string): { reasoning: string; answer: string } {
  const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/i);
  const reasoning  = thinkMatch ? thinkMatch[1].trim() : '';
  const answer     = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return { reasoning, answer };
}
