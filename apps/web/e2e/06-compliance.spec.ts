import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Compliance Module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/compliance');
    await page.waitForLoadState('networkidle');
  });

  test('displays compliance page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /compliance|work pass/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows work pass dashboard cards', async ({ page }) => {
    await page.waitForTimeout(2000);
    // Should show summary cards
    const body = await page.content();
    expect(body).toContain('Work Pass');
  });
});
