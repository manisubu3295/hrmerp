import { Page } from '@playwright/test';

export async function login(page: Page, email = 'admin@sankoerp.com', password = 'Admin@123!') {
  await page.goto('/login');
  // Labels don't have htmlFor, so use placeholder/type selectors
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /sign in to dashboard/i }).click();
  await page.waitForURL('/dashboard', { timeout: 15000 });
}

export async function loginAndSaveState(page: Page) {
  await login(page);
  // Wait for the store to hydrate
  await page.waitForTimeout(500);
}
