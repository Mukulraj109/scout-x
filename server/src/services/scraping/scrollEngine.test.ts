import { describe, it, expect } from 'vitest';
import { fingerprintRow } from './scrollEngine';

describe('fingerprintRow', () => {
  it('returns a stable JSON string for identical rows', () => {
    const a = { title: 'Hello World', price: '$10' };
    const b = { title: 'Hello World', price: '$10' };
    expect(fingerprintRow(a)).toBe(fingerprintRow(b));
  });

  it('collapses whitespace and lowercases values', () => {
    const row = { title: '  Hello   WORLD  ', description: '\nline\n' };
    expect(fingerprintRow(row)).toBe(JSON.stringify(['hello world', 'line']));
  });

  it('treats null and undefined as empty strings', () => {
    expect(fingerprintRow({ a: null, b: undefined, c: '' })).toBe(JSON.stringify(['', '', '']));
  });

  it('preserves field insertion order (distinct fingerprints for reordered keys)', () => {
    const one = fingerprintRow({ title: 'A', price: 'B' });
    const two = fingerprintRow({ price: 'B', title: 'A' });
    expect(one).not.toBe(two);
  });

  it('coerces non-string values to trimmed strings', () => {
    expect(fingerprintRow({ count: 42, active: true })).toBe(JSON.stringify(['42', 'true']));
  });

  it('matches the extension implementation byte-for-byte', () => {
    // Mirror of chrome-extension/src/content/extractionRunner.ts fingerprintRow.
    const extensionFingerprint = (row: Record<string, any>): string =>
      JSON.stringify(
        Object.values(row || {}).map((v) => {
          if (v === null || v === undefined) return '';
          const s = typeof v === 'string' ? v : String(v);
          return s.replace(/\s+/g, ' ').trim().toLowerCase();
        })
      );

    const samples: Record<string, any>[] = [
      { title: 'Foo', price: '$9.99' },
      { title: '  Bar\nbaz ', rating: 4.5 },
      { name: null, link: undefined, tag: 'X' },
      { a: 0, b: false, c: '' },
    ];
    for (const row of samples) {
      expect(fingerprintRow(row)).toBe(extensionFingerprint(row));
    }
  });
});
