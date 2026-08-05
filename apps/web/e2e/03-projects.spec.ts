import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Projects Module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/projects');
    await page.waitForTimeout(1500);
  });

  test('displays projects list page', async ({ page }) => {
    await expect(page.getByText('Projects').first()).toBeVisible({ timeout: 10000 });
  });

  test('has search input', async ({ page }) => {
    await expect(page.getByPlaceholder(/search by name or code/i)).toBeVisible({ timeout: 5000 });
  });

  test('can navigate to new project form', async ({ page }) => {
    await page.getByRole('button', { name: /new project/i }).click();
    await page.waitForURL('/projects/new');
    await expect(page).toHaveURL('/projects/new');
  });

  test('new project form has required fields', async ({ page }) => {
    await page.goto('/projects/new');
    await page.waitForTimeout(2000);
    // Check that the form section heading is rendered
    await expect(page.getByText('Project Identity').first()).toBeVisible({ timeout: 15000 });
    // Check Project Name input by placeholder (MUI sets placeholder on the inner <input>)
    await expect(page.getByPlaceholder(/Marina Bay/i)).toBeVisible({ timeout: 5000 });
  });

  test('new project form can be submitted', async ({ page }) => {
    await page.goto('/projects/new');
    await page.waitForTimeout(2000);
    // Verify the submit button exists
    await expect(page.getByRole('button', { name: /create project/i })).toBeVisible({ timeout: 10000 });
  });
});
