import { test, expect } from '@playwright/test';

test.describe('SPA smoke', () => {
  test('production preview serves the app shell', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page).toHaveTitle(/Maxun/i);
  });
});
