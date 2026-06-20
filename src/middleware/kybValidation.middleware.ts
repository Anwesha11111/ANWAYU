import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

// ─── GSTIN Validation ─────────────────────────────────────────────────────────
// Format: 2-digit state code + 10-char PAN + 1Z + 2 alphanumeric check digits
const GSTIN_REGEX = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const FREE_DOMAINS = new Set(
  (process.env.DOMAIN_BLOCKLIST || 'gmail.com,yahoo.com,hotmail.com,outlook.com,protonmail.com,yopmail.com,mailinator.com')
    .split(',')
    .map((d) => d.trim().toLowerCase())
);

function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() ?? '';
}

function isFreeDomain(email: string): boolean {
  return FREE_DOMAINS.has(extractDomain(email));
}

function validateGSTIN(gstin: string): { valid: boolean; reason?: string } {
  if (!gstin || gstin.length !== 15) {
    return { valid: false, reason: 'GSTIN must be exactly 15 characters' };
  }
  if (!GSTIN_REGEX.test(gstin)) {
    return { valid: false, reason: 'GSTIN does not match the required format (e.g., 27AAPFU0939F1ZV)' };
  }
  return { valid: true };
}

function validateCorporateDomain(domain: string): { valid: boolean; reason?: string } {
  // Must be a proper domain — not an IP, not localhost, not free email host
  if (!domain || domain.length < 4) {
    return { valid: false, reason: 'Corporate domain is required' };
  }
  if (FREE_DOMAINS.has(domain.toLowerCase())) {
    return { valid: false, reason: `Free/public email domain "${domain}" is not permitted for B2B access` };
  }
  // Basic domain format check
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
  if (!domainRegex.test(domain)) {
    return { valid: false, reason: 'Invalid corporate domain format' };
  }
  return { valid: true };
}

// ─── KYB Validation Middleware ───────────────────────────────────────────────
/**
 * kybValidationMiddleware
 *
 * Enforces strict B2B Know-Your-Business checks before allowing any
 * corporate client to reach the /api/kyb routes or query student directories.
 *
 * Required request fields (body or headers):
 *   - x-corporate-gstin   (header) OR body.gstin
 *   - x-corporate-domain  (header) OR body.corporate_domain
 *   - x-corporate-email   (header) OR body.contact_email
 */
export function kybValidationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const gstin   = (req.headers['x-corporate-gstin']  as string) || req.body?.gstin;
  const domain  = (req.headers['x-corporate-domain'] as string) || req.body?.corporate_domain;
  const email   = (req.headers['x-corporate-email']  as string) || req.body?.contact_email;

  const errors: string[] = [];

  // 1. GSTIN validation
  const gstinCheck = validateGSTIN(gstin);
  if (!gstinCheck.valid) errors.push(`GSTIN: ${gstinCheck.reason}`);

  // 2. Corporate domain validation
  if (domain) {
    const domainCheck = validateCorporateDomain(domain);
    if (!domainCheck.valid) errors.push(`Domain: ${domainCheck.reason}`);
  } else {
    errors.push('Domain: corporate_domain is required');
  }

  // 3. Contact email must not be a free domain
  if (email) {
    if (isFreeDomain(email)) {
      errors.push(`Email: Anonymous/free email "${email}" is not permitted. Use a corporate email address.`);
    }
  } else {
    errors.push('Email: contact_email is required');
  }

  if (errors.length > 0) {
    logger.warn('KYB validation failed — dropping connection', {
      gstin, domain, email_domain: email ? extractDomain(email) : null, errors,
    });
    res.status(403).json({
      success: false,
      error: 'KYB_VALIDATION_FAILED',
      message: 'Corporate identity verification failed. Connection dropped.',
      details: errors,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Attach validated fields for downstream controllers
  (req as Request & { kyb: Record<string, string> }).kyb = { gstin, domain, email };
  logger.info('KYB validation passed', { gstin, domain });
  next();
}
