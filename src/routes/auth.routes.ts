import { Router, Request, Response, NextFunction } from 'express';
import { runQuery } from '../config/database';
import { apiSuccess } from '../types';

export const authRouter = Router();

// POST /api/auth/register — placeholder stub
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Full implementation: validate body → hash password → insert user_profiles → issue JWT
    res.status(201).json(apiSuccess({ message: 'Registration endpoint — implementation pending' }));
  } catch (err) { next(err); }
});

// POST /api/auth/login — placeholder stub
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(apiSuccess({ message: 'Login endpoint — implementation pending' }));
  } catch (err) { next(err); }
});

// POST /api/auth/refresh — placeholder stub
authRouter.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(apiSuccess({ message: 'Token refresh — implementation pending' }));
  } catch (err) { next(err); }
});
