import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Reports Module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
  });

  test('displays reports page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /reports/i }).first()).toBeVisible({ timeout: 10000 });
  });
});
