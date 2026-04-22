import { describe, it, expect } from 'vitest';
import {
  validateCron,
  validateAutomationScheduleCron,
  computeNextRun,
} from './schedule';

describe('validateCron', () => {
  it('accepts common 5-field expressions', () => {
    for (const cron of ['*/10 * * * *', '*/15 * * * *', '0 * * * *', '0 0 * * *', '0 0 1 * *']) {
      const result = validateCron(cron, 'UTC');
      expect(result.ok, `expected "${cron}" to be valid`).toBe(true);
    }
  });

  it('rejects empty expressions', () => {
    const result = validateCron('', 'UTC');
    expect(result.ok).toBe(false);
  });

  it('rejects malformed cron strings', () => {
    for (const cron of ['not-a-cron', '*/ * * * *', '60 * * * *']) {
      const result = validateCron(cron, 'UTC');
      expect(result.ok, `expected "${cron}" to be rejected`).toBe(false);
    }
  });

  it('rejects invalid timezones', () => {
    const result = validateCron('*/10 * * * *', 'Not/A_Zone');
    expect(result.ok).toBe(false);
  });

  it('accepts valid tz like America/New_York and Asia/Kolkata', () => {
    expect(validateCron('0 9 * * *', 'America/New_York').ok).toBe(true);
    expect(validateCron('0 9 * * *', 'Asia/Kolkata').ok).toBe(true);
  });
});

describe('validateAutomationScheduleCron', () => {
  it('rejects intervals shorter than 15 minutes', () => {
    expect(validateAutomationScheduleCron('*/10 * * * *', 'UTC').ok).toBe(false);
    expect(validateAutomationScheduleCron('*/5 * * * *', 'UTC').ok).toBe(false);
    expect(validateAutomationScheduleCron('* * * * *', 'UTC').ok).toBe(false);
  });

  it('accepts */15 and hourly or slower', () => {
    expect(validateAutomationScheduleCron('*/15 * * * *', 'UTC').ok).toBe(true);
    expect(validateAutomationScheduleCron('0 * * * *', 'UTC').ok).toBe(true);
    expect(validateAutomationScheduleCron('0 0 * * *', 'UTC').ok).toBe(true);
  });
});

describe('computeNextRun', () => {
  it('returns a future Date for a valid expression', () => {
    const next = computeNextRun('*/10 * * * *', 'UTC');
    expect(next).toBeInstanceOf(Date);
    expect((next as Date).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it('returns null for invalid input', () => {
    expect(computeNextRun('bogus', 'UTC')).toBeNull();
  });
});
