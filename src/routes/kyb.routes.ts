import { Router, Request, Response, NextFunction } from 'express';
import { apiSuccess } from '../types';

export const kybRouter = Router();

// POST /api/kyb/register — register corporate client (post-KYB validation)
kybRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kyb } = req as Request & { kyb: Record<string, string> };
    // KYB fields already validated by kybValidationMiddleware
    res.status(201).json(apiSuccess({
      message: 'Corporate registration received. KYB review in progress.',
      gstin: kyb.gstin,
      domain: kyb.domain,
    }));
  } catch (err) { next(err); }
});

// GET /api/kyb/status/:gstin — check KYB verification status
kybRouter.get('/status/:gstin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runQuery } = await import('../config/database');
    const rows = await runQuery<{ kyb_status: string; kyb_verified_at: Date }>(
      'SELECT kyb_status, kyb_verified_at FROM corporate_clients WHERE gstin = $1',
      [req.params.gstin]
    );
    if (!rows.length) {
      res.status(404).json({ success: false, error: 'NOT_FOUND' });
      return;
    }
    res.json(apiSuccess(rows[0]));
  } catch (err) { next(err); }
});
