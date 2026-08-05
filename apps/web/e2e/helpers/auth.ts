import { Page } from '@playwright/test';

/**
 * Navigate to the authenticated dashboard.
 * Auth state (localStorage token) is pre-loaded via playwright.config.ts storageState,
 * so no actual login request is made — this avoids hitting the rate limiter.
 */
export async function login(page: Page) {
  await page.goto('/dashboard');
  await page.waitForURL('/dashboard', { timeout: 10000 });
}

export async function loginAndSaveState(page: Page) {
  await login(page);
}
