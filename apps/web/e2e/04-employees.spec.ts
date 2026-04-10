import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Employees Module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/employees');
    await page.waitForLoadState('networkidle');
  });

  test('displays employees list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /employees/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('shows seeded employees', async ({ page }) => {
    // Ali Hassan and Ramu Kumar were seeded
    await page.waitForTimeout(2000);
    const body = await page.content();
    const hasEmployees = body.includes('Ali') || body.includes('Ramu') || body.includes('EMP-');
    expect(hasEmployees).toBe(true);
  });

  test('can navigate to add employee', async ({ page }) => {
    await page.getByRole('link', { name: /add employee/i }).click();
    await page.waitForURL('/employees/new');
    await expect(page).toHaveURL('/employees/new');
  });
});
