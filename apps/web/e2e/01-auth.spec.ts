import { test, expect } from '@playwright/test';

// Auth tests verify the login page and auth flow, so they must run
// without the pre-loaded auth state from storageState.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
  test('shows login page for unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('shows login page with correct content', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('Sign in to your Aadhirai HRM OS dashboard')).toBeVisible();
  });

  test('fails with wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('wrong@email.com');
    await page.locator('input[type="password"]').fill('wrongpass');
    await page.getByRole('button', { name: /sign in/i }).click();
    // Should stay on login page
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/login/);
  });

  test('logs in successfully with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('admin@aadhirai.com');
    await page.locator('input[type="password"]').fill('Admin@123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL('/dashboard');
  });

  test('sign in button is present and clickable', async ({ page }) => {
    await page.goto('/login');
    const btn = page.getByRole('button', { name: /sign in/i });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });
});
