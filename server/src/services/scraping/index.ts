/**
 * Shared scraping helpers used by both cloud list engines:
 *   - Engine 1: `maxun-core/src/interpret.ts` (recorded robot path)
 *   - Engine 2: `server/src/services/listExtractor.ts` (SaaS list jobs)
 *
 * The goal is behavioural parity with the Chrome extension's in-page scraper
 * (`chrome-extension/src/content/extractionRunner.ts`) so a robot configured
 * in the sidepanel reproduces the same scroll / pagination / overlay /
 * captcha handling when it runs on a schedule in the cloud.
 */
export * from './scrollEngine';
export * from './overlayDismisser';
export * from './captchaGate';
