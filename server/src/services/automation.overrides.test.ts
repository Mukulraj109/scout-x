import { describe, it, expect } from 'vitest';
import {
  applyColumnOverrides,
  collectOmitKeys,
  type ColumnOverride,
} from './automation';

describe('collectOmitKeys', () => {
  it('collects original and rename targets for omitted columns', () => {
    const overrides: Record<string, ColumnOverride> = {
      date: { omit: true, rename: 'posted_date' },
      url: { omit: true },
    };
    const keys = collectOmitKeys(overrides);
    expect(keys.has('date')).toBe(true);
    expect(keys.has('posted_date')).toBe(true);
    expect(keys.has('url')).toBe(true);
    expect(keys.has('company')).toBe(false);
  });

  it('ignores non-omit overrides', () => {
    const overrides: Record<string, ColumnOverride> = {
      x: { rename: 'y' },
      z: { clear: true },
    };
    expect(collectOmitKeys(overrides).size).toBe(0);
  });
});

describe('applyColumnOverrides', () => {
  it('passes through when overrides empty', () => {
    expect(applyColumnOverrides({ a: 1 }, {})).toEqual({ a: 1 });
    expect(applyColumnOverrides({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it('still renames and clears when no omit', () => {
    expect(
      applyColumnOverrides({ date: 'Mon' }, { date: { rename: 'posted_date' } })
    ).toEqual({ posted_date: 'Mon' });
    expect(
      applyColumnOverrides({ title: 'Hi' }, { title: { clear: true } })
    ).toEqual({ title: '' });
  });

  it('drops omitted keys from raw scrape-shaped rows', () => {
    expect(
      applyColumnOverrides({ date: 'Mon', url: 'http://x' }, { date: { omit: true } })
    ).toEqual({ url: 'http://x' });
  });

  it('drops legacy renamed keys when omit lists prior rename target', () => {
    const row = { posted_date: 'Mon', url: 'http://x' };
    expect(
      applyColumnOverrides(row, { date: { omit: true, rename: 'posted_date' } })
    ).toEqual({ url: 'http://x' });
  });

  it('drops raw original key when omit only references original', () => {
    expect(
      applyColumnOverrides({ date: 'Mon' }, { date: { omit: true } })
    ).toEqual({});
  });

  it('does not drop unrelated keys that match omit rename target without omit rule', () => {
    expect(
      applyColumnOverrides({ posted_date: 'keep' }, { date: { rename: 'posted_date' } })
    ).toEqual({ posted_date: 'keep' });
  });

  it('reject overlap: omit wins over rename/clear for same source key', () => {
    expect(
      applyColumnOverrides({ date: 'x' }, { date: { omit: true, rename: 'posted_date', clear: true } })
    ).toEqual({});
  });
});
