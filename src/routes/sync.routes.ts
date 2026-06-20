import { Router } from 'express';
import { deltaSyncHandler } from '../controllers/sync.controller';

export const syncRouter = Router();

// POST /api/sync/delta — CRDT/LWW offline sync merge
syncRouter.post('/delta', deltaSyncHandler);
