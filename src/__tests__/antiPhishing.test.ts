import { sanitizeMessage } from '../../middleware/antiPhishing.middleware';

describe('Anti-Phishing Sanitizer', () => {
  // ── Phone number redaction ──────────────────────────────────────────────
  test('redacts Indian mobile number (10-digit)', () => {
    const { sanitized, redacted, hasWarnings } = sanitizeMessage('Call me at 9876543210 anytime.');
    expect(hasWarnings).toBe(true);
    expect(redacted).toHaveLength(1);
    expect(redacted[0].type).toBe('phone');
    expect(sanitized).not.toContain('9876543210');
    expect(sanitized).toContain('PHONE NUMBER REDACTED');
  });

  test('redacts +91 prefixed mobile number', () => {
    const { redacted } = sanitizeMessage('WhatsApp: +91-9812345678');
    expect(redacted[0].type).toBe('phone');
  });

  // ── Email redaction ─────────────────────────────────────────────────────
  test('redacts email addresses', () => {
    const { sanitized, redacted } = sanitizeMessage('Contact us at hr@fake-company.com for more details.');
    expect(redacted[0].type).toBe('email');
    expect(sanitized).not.toContain('hr@fake-company.com');
    expect(sanitized).toContain('EMAIL ADDRESS REDACTED');
  });

  // ── Checkout / payment link redaction ───────────────────────────────────
  test('redacts Razorpay payment link', () => {
    const { redacted } = sanitizeMessage('Pay here: https://razorpay.com/pay/ABCD123');
    expect(redacted[0].type).toBe('checkout_link');
  });

  test('redacts Paytm checkout link', () => {
    const { redacted } = sanitizeMessage('Complete payment: https://paytm.com/checkout/merchant');
    expect(redacted[0].type).toBe('checkout_link');
  });

  // ── External URL redaction ──────────────────────────────────────────────
  test('redacts generic external URLs', () => {
    const { redacted } = sanitizeMessage('Visit https://suspicious-jobs-india.com/apply now!');
    expect(['external_url', 'checkout_link']).toContain(redacted[0].type);
  });

  // ── Clean message passes through ────────────────────────────────────────
  test('does not alter clean message', () => {
    const msg = 'Hello! Your Math assignment is due tomorrow.';
    const { sanitized, hasWarnings } = sanitizeMessage(msg);
    expect(hasWarnings).toBe(false);
    expect(sanitized).toBe(msg);
  });

  // ── Multiple violations in one message ──────────────────────────────────
  test('handles multiple violations in a single message', () => {
    const { redacted } = sanitizeMessage(
      'Call 9876543210 or email fake@phishing.org — pay at https://razorpay.com/pay/XYZ'
    );
    const types = redacted.map((r) => r.type);
    expect(types).toContain('phone');
    expect(types).toContain('email');
    expect(types).toContain('checkout_link');
  });

  // ── Safety notice appended when violations found ─────────────────────────
  test('appends GramGyan Safety Notice when violations found', () => {
    const { sanitized } = sanitizeMessage('Call 8765432109 for job offer');
    expect(sanitized).toContain('GramGyan Safety Notice');
  });
});
