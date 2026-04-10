import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('shows login page for unauthenticated users', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });

  test('shows login page with correct content', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('Sign in to your account')).toBeVisible();
    await expect(page.getByText('Demo access')).toBeVisible();
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
    await page.locator('input[type="email"]').fill('admin@sankoerp.com');
    await page.locator('input[type="password"]').fill('Admin@123!');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL('/dashboard');
  });

  test('demo credential fill works', async ({ page }) => {
    await page.goto('/login');
    // Click the Super Admin demo row to fill credentials
    await page.getByText('Super Admin').click();
    // Fields should be filled
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveValue('admin@sankoerp.com');
  });
});
