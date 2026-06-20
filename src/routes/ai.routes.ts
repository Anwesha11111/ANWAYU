import { Router } from 'express';
import { handleAIQuery, handleLinkScan, getScamResult, getNetworkConfig } from '../controllers/ai.controller';

export const aiRouter = Router();

// POST /api/ai/query — main multi-model routing endpoint
aiRouter.post('/query', handleAIQuery);

// POST /api/ai/scan-link — async scam/phishing check (returns log_id immediately)
aiRouter.post('/scan-link', handleLinkScan);

// GET  /api/ai/scan-result/:id — poll for async scam result
aiRouter.get('/scan-result/:id', getScamResult);

// GET  /api/ai/network-config — returns current network profile + media config
aiRouter.get('/network-config', getNetworkConfig);
