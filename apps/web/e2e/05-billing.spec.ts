import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Billing Module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/billing');
    await page.waitForLoadState('networkidle');
  });

  test('displays billing page with summary cards', async ({ page }) => {
    await expect(page.getByText('Billing & Invoices').first()).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to create invoice', async ({ page }) => {
    await page.getByRole('button', { name: /new invoice/i }).click();
    await page.waitForURL('/billing/new');
    await expect(page).toHaveURL('/billing/new');
  });
});
