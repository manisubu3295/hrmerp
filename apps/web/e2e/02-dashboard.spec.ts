import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('displays dashboard with KPI cards', async ({ page }) => {
    await expect(page.getByText('Active Projects')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Monthly Revenue')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Monthly Profit')).toBeVisible({ timeout: 10000 });
  });

  test('shows status indicators', async ({ page }) => {
    // Status indicators only appear after API responds — wait longer
    await expect(page.getByText('Compliance').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Inventory').first()).toBeVisible({ timeout: 10000 });
  });

  test('sidebar navigation is visible', async ({ page }) => {
    // Use link role matching which works regardless of flash states
    await expect(page.getByRole('link', { name: /projects/i }).first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: /employees/i }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: /billing/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('can navigate to projects from sidebar', async ({ page }) => {
    await page.getByRole('link', { name: /^projects$/i }).first().click();
    await page.waitForURL('/projects');
    await expect(page).toHaveURL('/projects');
  });

  test('all modules accessible from sidebar', async ({ page }) => {
    await expect(page.getByRole('link', { name: /compliance/i }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /reports/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /clients/i }).first()).toBeVisible();
  });
});
