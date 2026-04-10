import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

const routes = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/projects', name: 'Projects' },
  { path: '/employees', name: 'Employees' },
  { path: '/quotations', name: 'Quotations' },
  { path: '/expenses', name: 'Expenses' },
  { path: '/equipment', name: 'Equipment' },
  { path: '/billing', name: 'Billing' },
  { path: '/compliance', name: 'Compliance' },
  { path: '/reports', name: 'Reports' },
  { path: '/notifications', name: 'Notifications' },
  { path: '/clients', name: 'Clients' },
];

test.describe('Navigation - All Modules Load', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const route of routes) {
    test(`${route.name} page loads without error`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      // No error page
      await expect(page.locator('body')).not.toContainText('Application error');
      await expect(page.locator('body')).not.toContainText('500');
      // Should not redirect to login
      await expect(page).toHaveURL(new RegExp(route.path));
    });
  }
});
