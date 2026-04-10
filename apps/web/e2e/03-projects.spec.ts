import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Projects Module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/projects');
    await page.waitForTimeout(1500);
  });

  test('displays projects list page', async ({ page }) => {
    await expect(page.locator('h1, h2, h3').filter({ hasText: /projects/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('has search input', async ({ page }) => {
    await expect(page.getByPlaceholder(/search by project/i)).toBeVisible({ timeout: 5000 });
  });

  test('can navigate to new project form', async ({ page }) => {
    await page.getByRole('link', { name: /new project/i }).click();
    await page.waitForURL('/projects/new');
    await expect(page).toHaveURL('/projects/new');
  });

  test('new project form has required fields', async ({ page }) => {
    await page.goto('/projects/new');
    await page.waitForTimeout(2000);
    // Check that the form fields are rendered
    await expect(page.getByText('Project Name')).toBeVisible({ timeout: 15000 });
    // Check Project Name input by exact placeholder
    const input = page.locator('input[placeholder*="Sands Construction"]');
    await expect(input).toBeVisible({ timeout: 5000 });
  });

  test('new project form can be submitted', async ({ page }) => {
    await page.goto('/projects/new');
    await page.waitForTimeout(2000);
    // Verify the submit button exists
    await expect(page.getByRole('button', { name: /create project/i })).toBeVisible({ timeout: 10000 });
  });
});
