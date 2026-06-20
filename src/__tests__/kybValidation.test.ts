import { kybValidationMiddleware } from '../../middleware/kybValidation.middleware';
import { Request, Response, NextFunction } from 'express';

function makeMocks(overrides: Partial<{ headers: Record<string, string>; body: Record<string, string> }> = {}) {
  const req = {
    headers: overrides.headers ?? {},
    body: overrides.body ?? {},
  } as unknown as Request;

  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json } as unknown as Response;
  const next = jest.fn() as NextFunction;

  return { req, res, next, json, status };
}

describe('KYB Validation Middleware', () => {
  // ── Valid corporate client ────────────────────────────────────────────────
  test('passes valid GSTIN + corporate domain + corporate email', () => {
    const { req, res, next } = makeMocks({
      headers: {
        'x-corporate-gstin':  '27AAPFU0939F1ZV',
        'x-corporate-domain': 'infosys.com',
        'x-corporate-email':  'hr@infosys.com',
      },
    });
    kybValidationMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  // ── Invalid GSTIN ─────────────────────────────────────────────────────────
  test('rejects malformed GSTIN', () => {
    const { req, res, next, status } = makeMocks({
      headers: {
        'x-corporate-gstin':  'INVALID',
        'x-corporate-domain': 'company.com',
        'x-corporate-email':  'admin@company.com',
      },
    });
    kybValidationMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  // ── Free domain rejection ─────────────────────────────────────────────────
  test('rejects gmail.com contact email', () => {
    const { req, res, next, status } = makeMocks({
      headers: {
        'x-corporate-gstin':  '27AAPFU0939F1ZV',
        'x-corporate-domain': 'legitimate-company.com',
        'x-corporate-email':  'hr@gmail.com',
      },
    });
    kybValidationMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  test('rejects yahoo.com contact email', () => {
    const { req, res, next, status } = makeMocks({
      headers: {
        'x-corporate-gstin':  '27AAPFU0939F1ZV',
        'x-corporate-domain': 'legit.in',
        'x-corporate-email':  'ceo@yahoo.com',
      },
    });
    kybValidationMiddleware(req, res, next);
    expect(status).toHaveBeenCalledWith(403);
  });

  // ── Missing fields ────────────────────────────────────────────────────────
  test('rejects when all KYB fields are missing', () => {
    const { req, res, next, status } = makeMocks();
    kybValidationMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  // ── Body fallback ─────────────────────────────────────────────────────────
  test('accepts KYB fields from request body (not headers)', () => {
    const { req, res, next } = makeMocks({
      body: {
        gstin:            '29AABCT1332L1ZN',
        corporate_domain: 'tcs.com',
        contact_email:    'partner@tcs.com',
      },
    });
    kybValidationMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
