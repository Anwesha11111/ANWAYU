import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

// ── Route Imports ─────────────────────────────────────────────────────────
import { aiRouter } from './routes/ai.routes';
import { syncRouter } from './routes/sync.routes';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { kybRouter } from './routes/kyb.routes';
import { chatRouter } from './routes/chat.routes';

// ── Middleware Imports ────────────────────────────────────────────────────
import { kybValidationMiddleware } from './middleware/kybValidation.middleware';
import { antiPhishingMiddleware } from './middleware/antiPhishing.middleware';
import { errorHandler } from './middleware/errorHandler.middleware';
import { requestLogger } from './middleware/requestLogger.middleware';
import { networkProfileMiddleware } from './middleware/networkProfile.middleware';

const app: Application = express();

// ── Security Headers ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Network-Profile', 'X-Request-ID', 'X-Client-Version'],
}));

// ── Compression ────────────────────────────────────────────────────────────
app.use(compression());

// ── Body Parsers ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Request Logging ────────────────────────────────────────────────────────
app.use(morgan('combined'));
app.use(requestLogger);

// ── Global Rate Limiting ───────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI query rate limit exceeded.' },
});

app.use(globalLimiter);

// ── Network Profile Detection ─────────────────────────────────────────────
app.use(networkProfileMiddleware);

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/ai', aiLimiter, aiRouter);
app.use('/api/sync', syncRouter);
app.use('/api/kyb', kybValidationMiddleware, kybRouter);
app.use('/api/chat', antiPhishingMiddleware, chatRouter);

// ── 404 Handler ───────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    timestamp: new Date().toISOString(),
  });
});

// ── Global Error Handler ──────────────────────────────────────────────────
app.use(errorHandler);

export default app;
