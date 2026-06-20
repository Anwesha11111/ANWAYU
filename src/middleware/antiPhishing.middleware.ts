import { Request, Response, NextFunction } from 'express';
import type { RedactedItem } from '../types';
import { logger } from '../config/logger';

// ─── Regex Patterns ───────────────────────────────────────────────────────────

/** Indian mobile: +91-XXXXXXXXXX, 0XXXXXXXXXX, 10-digit starting 6-9 */
const PHONE_REGEX = /(?:\+91[\s-]?|0)?[6-9]\d{9}/g;

/** Email addresses — any domain */
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/** HTTP/HTTPS checkout / payment links — common payment gateways & generic */
const CHECKOUT_REGEX =
  /https?:\/\/(?:www\.)?(?:razorpay|paytm|stripe|paypal|cashfree|instamojo|phonepe|gpay)[^\s"']*/gi;

/** Generic external HTTP links (non-gramgyan domains) */
const EXTERNAL_LINK_REGEX =
  /https?:\/\/(?!(?:gramgyan\.com|localhost)[^\s"'])[^\s"'<>]{8,}/gi;

// ─── Warning Messages ─────────────────────────────────────────────────────────
const WARNING_TEMPLATES: Record<RedactedItem['type'], string> = {
  phone:         '[⚠️ PHONE NUMBER REDACTED — share contact details only through official GramGyan channels]',
  email:         '[⚠️ EMAIL ADDRESS REDACTED — use in-platform messaging for secure communication]',
  checkout_link: '[🚫 PAYMENT LINK BLOCKED — GramGyan will never ask students to pay through external links]',
  external_url:  '[⚠️ EXTERNAL LINK REMOVED — links have been flagged for safety review]',
};

// ─── Core Sanitizer ──────────────────────────────────────────────────────────
export function sanitizeMessage(rawText: string): {
  sanitized: string;
  redacted: RedactedItem[];
  hasWarnings: boolean;
} {
  let text = rawText;
  const redacted: RedactedItem[] = [];

  const replaceAll = (regex: RegExp, type: RedactedItem['type']) => {
    const matches = text.match(regex) ?? [];
    for (const match of matches) {
      redacted.push({ type, original: match, replaced_with: WARNING_TEMPLATES[type] });
    }
    text = text.replace(regex, WARNING_TEMPLATES[type]);
  };

  // Order matters: payment links before generic URLs
  replaceAll(CHECKOUT_REGEX, 'checkout_link');
  replaceAll(EXTERNAL_LINK_REGEX, 'external_url');
  replaceAll(EMAIL_REGEX, 'email');
  replaceAll(PHONE_REGEX, 'phone');

  const hasWarnings = redacted.length > 0;

  if (hasWarnings) {
    text += '\n\n🔒 [GramGyan Safety Notice: Personal contact details or external links were detected and removed from this message to protect students.]';
  }

  return { sanitized: text, redacted, hasWarnings };
}

// ─── Express Middleware ──────────────────────────────────────────────────────
/**
 * antiPhishingMiddleware
 *
 * Intercepts POST /api/chat messages from corporate entities.
 * Sanitizes req.body.content before it reaches the route handler.
 * Attaches sanitization metadata to req so the controller can persist it.
 */
export function antiPhishingMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.body || typeof req.body.content !== 'string') {
    return next();
  }

  const { sanitized, redacted, hasWarnings } = sanitizeMessage(req.body.content);

  // Mutate body — downstream sees clean content
  req.body.original_content = req.body.content;
  req.body.content          = sanitized;
  req.body._redacted        = redacted;
  req.body._has_warnings    = hasWarnings;

  if (hasWarnings) {
    logger.warn('Anti-phishing: content sanitized', {
      user_id: (req as unknown as Record<string, unknown>).user?.id,
      redacted_count: redacted.length,
      types: redacted.map((r) => r.type),
    });
  }

  next();
}
