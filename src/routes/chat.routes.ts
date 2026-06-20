import { Router, Request, Response, NextFunction } from 'express';
import { runQuery } from '../config/database';
import { apiSuccess, apiError } from '../types';
import type { RedactedItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const chatRouter = Router();

// POST /api/chat/message — send a chat message (anti-phishing already applied)
chatRouter.post('/message', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      session_id = uuidv4(),
      sender_id,
      receiver_id,
      content,                  // sanitized by antiPhishingMiddleware
      original_content,         // injected by middleware
      _redacted = [],
      _has_warnings = false,
    } = req.body as {
      session_id?: string;
      sender_id: string;
      receiver_id?: string;
      content: string;
      original_content: string;
      _redacted: RedactedItem[];
      _has_warnings: boolean;
    };

    if (!sender_id || !content) {
      res.status(400).json(apiError('INVALID_REQUEST', '`sender_id` and `content` required'));
      return;
    }

    const rows = await runQuery<{ id: string }>(
      `INSERT INTO chat_messages
       (session_id, sender_id, receiver_id, original_content, sanitized_content,
        redacted_items, security_warning)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        session_id, sender_id, receiver_id ?? null,
        original_content ?? content, content,
        JSON.stringify(_redacted),
        _has_warnings ? 'Content was sanitized by GramGyan Safety System' : null,
      ]
    );

    res.status(201).json(apiSuccess({
      message_id:   rows[0].id,
      session_id,
      sanitized:    _has_warnings,
      redacted_count: _redacted.length,
    }));
  } catch (err) { next(err); }
});

// GET /api/chat/session/:id — fetch chat session history
chatRouter.get('/session/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messages = await runQuery(
      `SELECT id, sender_id, receiver_id, sanitized_content AS content,
              redacted_items, security_warning, is_ai_response, created_at
       FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(apiSuccess(messages));
  } catch (err) { next(err); }
});
