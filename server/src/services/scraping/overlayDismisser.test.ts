import { describe, it, expect, vi } from 'vitest';
import { dismissNow, installDialogHandler } from './overlayDismisser';

describe('dismissNow', () => {
  it('no-ops when autoDismiss=false', async () => {
    const page: any = { evaluate: vi.fn(async () => 3) };
    const clicks = await dismissNow(page, { autoDismiss: false });
    expect(clicks).toBe(0);
    expect(page.evaluate).not.toHaveBeenCalled();
  });

  it('returns the number of clicks reported by the page evaluator', async () => {
    const page: any = { evaluate: vi.fn(async () => 2) };
    const clicks = await dismissNow(page);
    expect(clicks).toBe(2);
    expect(page.evaluate).toHaveBeenCalledTimes(1);
  });

  it('returns 0 and swallows errors when evaluate rejects', async () => {
    const page: any = {
      evaluate: vi.fn(async () => {
        throw new Error('evaluate failed');
      }),
    };
    const clicks = await dismissNow(page);
    expect(clicks).toBe(0);
  });
});

describe('installDialogHandler', () => {
  it('registers a page dialog listener and returns a detach fn', () => {
    const page: any = { on: vi.fn(), off: vi.fn() };
    const detach = installDialogHandler(page);
    expect(page.on).toHaveBeenCalledWith('dialog', expect.any(Function));
    detach();
    expect(page.off).toHaveBeenCalledTimes(1);
  });

  it('dismisses dialogs by default', async () => {
    let handler: ((d: any) => void) | undefined;
    const page: any = { on: (evt: string, h: any) => ((handler = h), undefined), off: vi.fn() };
    installDialogHandler(page);
    expect(handler).toBeDefined();

    const dialog = { type: () => 'confirm', message: () => 'continue?', accept: vi.fn(), dismiss: vi.fn() };
    await handler!(dialog);
    expect(dialog.dismiss).toHaveBeenCalled();
    expect(dialog.accept).not.toHaveBeenCalled();
  });

  it('accepts dialogs when acceptDialogs=true', async () => {
    let handler: ((d: any) => void) | undefined;
    const page: any = { on: (_: string, h: any) => ((handler = h), undefined), off: vi.fn() };
    installDialogHandler(page, { acceptDialogs: true });

    const dialog = { type: () => 'alert', message: () => '18+?', accept: vi.fn(), dismiss: vi.fn() };
    await handler!(dialog);
    expect(dialog.accept).toHaveBeenCalled();
    expect(dialog.dismiss).not.toHaveBeenCalled();
  });
});
