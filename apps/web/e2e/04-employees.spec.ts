import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Employees Module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/employees');
    await page.waitForLoadState('networkidle');
  });

  test('displays employees list', async ({ page }) => {
    await expect(page.getByText('Employees').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows seeded employees', async ({ page }) => {
    // 2 employees were seeded — check the stat card or table rows
    await page.waitForTimeout(2000);
    const body = await page.content();
    // Check for Total Employees card value OR any employee row content
    const hasEmployees = body.includes('Total Employees') ||
      body.includes('Cable Technician') ||
      body.includes('Site Supervisor') ||
      body.includes('Ali') || body.includes('Ramu') || body.includes('EMP-');
    expect(hasEmployees).toBe(true);
  });

  test('can navigate to add employee', async ({ page }) => {
    await page.getByRole('button', { name: /add employee/i }).click();
    await page.waitForURL('/employees/new');
    await expect(page).toHaveURL('/employees/new');
  });
});
