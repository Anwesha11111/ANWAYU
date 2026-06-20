import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  res.setHeader('X-Request-ID', requestId);

  const start = Date.now();

  res.on('finish', () => {
    logger.info('HTTP request', {
      request_id:  requestId,
      method:      req.method,
      path:        req.path,
      status:      res.statusCode,
      duration_ms: Date.now() - start,
      ip:          req.ip,
      user_agent:  req.headers['user-agent'],
      network:     req.headers['x-network-profile'],
    });
  });

  next();
}
