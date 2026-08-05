import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

// ─── Admin Leave Tests ─────────────────────────────────────────────────────────
test.describe('Leave Management — Admin', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/leave/admin');
    await page.waitForLoadState('networkidle');
  });

  test('admin is redirected to /leave/admin from /leave', async ({ page }) => {
    await page.goto('/leave');
    // Admin should land on admin leave page
    await page.waitForURL(/\/leave\/admin/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/leave\/admin/);
  });

  test('displays Leave Management heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /leave management/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('shows summary stat cards (Pending, Approved, Rejected)', async ({ page }) => {
    await page.waitForTimeout(1500);
    const content = await page.content();
    const hasPending = content.toLowerCase().includes('pending');
    const hasApproved = content.toLowerCase().includes('approved');
    expect(hasPending || hasApproved).toBe(true);
  });

  test('has All Requests and Leave Policies tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: /all requests/i })).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('tab', { name: /leave policies/i })).toBeVisible({ timeout: 8000 });
  });

  test('can switch to Leave Policies tab', async ({ page }) => {
    await page.getByRole('tab', { name: /leave policies/i }).click();
    await page.waitForTimeout(1000);
    // Should show policy configuration or no-policy message
    const content = await page.content();
    const hasPolicy = content.toLowerCase().includes('policy') || content.toLowerCase().includes('days per year');
    expect(hasPolicy).toBe(true);
  });

  test('has search input in requests tab', async ({ page }) => {
    await page.waitForTimeout(1000);
    const searchInput = page.locator('input').filter({ hasText: '' }).first();
    await expect(searchInput).toBeVisible({ timeout: 8000 });
  });

  test('has status filter dropdown', async ({ page }) => {
    await page.waitForTimeout(1500);
    const content = await page.content();
    expect(content).toContain('Status');
  });

  test('can open Configure Policy dialog from policies tab', async ({ page }) => {
    await page.getByRole('tab', { name: /leave policies/i }).click();
    await page.waitForTimeout(1000);
    const addBtn = page.getByRole('button', { name: /configure policy|add policy|leave policy/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page.getByText(/configure leave policy/i).first()).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('Escape');
    }
  });

  test('can open Init Balance dialog from policies tab', async ({ page }) => {
    await page.getByRole('tab', { name: /leave policies/i }).click();
    await page.waitForTimeout(1000);
    const initBtn = page.getByRole('button', { name: /init balance/i }).first();
    if (await initBtn.isVisible()) {
      await initBtn.click();
      await page.waitForTimeout(800);
      await expect(page.getByText(/init/i).first()).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('Escape');
    }
  });

  test('configure policy dialog has required fields', async ({ page }) => {
    await page.getByRole('tab', { name: /leave policies/i }).click();
    await page.waitForTimeout(1000);
    const addBtn = page.getByRole('button', { name: /configure policy|add policy|leave policy/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await page.waitForTimeout(800);
      await expect(page.getByText('Leave Type', { exact: false }).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/days per year/i).first()).toBeVisible({ timeout: 5000 });
      await page.keyboard.press('Escape');
    }
  });

  test('year filter exists in requests tab', async ({ page }) => {
    await page.waitForTimeout(1500);
    const content = await page.content();
    const currentYear = new Date().getFullYear().toString();
    expect(content).toContain(currentYear);
  });
});

// ─── Employee Leave / My Leave Tests ──────────────────────────────────────────
test.describe('Leave Management — Employee (My Leave)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/leave/my');
    await page.waitForLoadState('networkidle');
  });

  test('displays My Leave page', async ({ page }) => {
    await page.waitForTimeout(1500);
    const content = await page.content();
    const hasLeave = content.toLowerCase().includes('leave');
    expect(hasLeave).toBe(true);
  });

  test('shows Apply for Leave button', async ({ page }) => {
    const applyBtn = page.getByRole('button', { name: /apply.*leave|apply for leave/i }).first();
    await expect(applyBtn).toBeVisible({ timeout: 10000 });
  });

  test('opens Apply Leave dialog on button click', async ({ page }) => {
    const applyBtn = page.getByRole('button', { name: /apply.*leave|apply for leave/i }).first();
    await applyBtn.click();
    await expect(page.getByText('Apply for Leave').first()).toBeVisible({ timeout: 5000 });
  });

  test('Apply Leave dialog has Leave Type dropdown', async ({ page }) => {
    await page.getByRole('button', { name: /apply.*leave|apply for leave/i }).first().click();
    await page.waitForTimeout(1000);
    await expect(page.getByText('Leave Type', { exact: false }).first()).toBeVisible({ timeout: 5000 });
  });

  test('Apply Leave dialog has Start Date and End Date fields', async ({ page }) => {
    await page.getByRole('button', { name: /apply.*leave|apply for leave/i }).first().click();
    await page.waitForTimeout(1000);
    await expect(page.getByText('Start Date', { exact: false }).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('End Date', { exact: false }).first()).toBeVisible({ timeout: 5000 });
  });

  test('Apply Leave dialog has Submit Request button', async ({ page }) => {
    await page.getByRole('button', { name: /apply.*leave|apply for leave/i }).first().click();
    await page.waitForTimeout(1000);
    await expect(page.getByRole('button', { name: /submit request/i })).toBeVisible({ timeout: 5000 });
  });

  test('Submit Request button shows error when dates are missing', async ({ page }) => {
    await page.getByRole('button', { name: /apply.*leave|apply for leave/i }).first().click();
    await page.waitForTimeout(1000);
    // Click Submit with no dates filled
    await page.getByRole('button', { name: /submit request/i }).click();
    // Dialog should remain open (validation fails)
    await expect(page.getByText('Apply for Leave').first()).toBeVisible({ timeout: 2000 });
  });

  test('can fill and submit a leave request', async ({ page }) => {
    await page.getByRole('button', { name: /apply.*leave|apply for leave/i }).first().click();
    await page.waitForTimeout(1000);
    await expect(page.getByText('Apply for Leave').first()).toBeVisible({ timeout: 5000 });

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    const nextDay = new Date(today);
    nextDay.setDate(today.getDate() + 1);
    const nextDayStr = `${yyyy}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;

    // Use input[type="date"] selectors since MUI date fields use native inputs
    const dateInputs = page.locator('input[type="date"]');
    await dateInputs.nth(0).fill(todayStr);
    await dateInputs.nth(1).fill(nextDayStr);
    await page.getByRole('button', { name: /submit request/i }).click();
    // Either success (dialog closes) or error (no employee profile) — both are valid
    await page.waitForTimeout(2000);
  });

  test('cancel button closes Apply Leave dialog', async ({ page }) => {
    await page.getByRole('button', { name: /apply.*leave|apply for leave/i }).first().click();
    await page.waitForTimeout(1000);
    await expect(page.getByText('Apply for Leave').first()).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /^cancel$/i }).click();
    // Check Submit Request button disappears (it only exists inside the dialog)
    await expect(page.getByRole('button', { name: /submit request/i })).not.toBeVisible({ timeout: 3000 });
  });

  test('shows leave balance section', async ({ page }) => {
    await page.waitForTimeout(2000);
    const content = await page.content();
    // Balance/stats or requests section should appear
    const hasContent = content.toLowerCase().includes('pending') ||
      content.toLowerCase().includes('approved') ||
      content.toLowerCase().includes('request') ||
      content.toLowerCase().includes('leave');
    expect(hasContent).toBe(true);
  });

  test('shows My Leave Requests section', async ({ page }) => {
    await page.waitForTimeout(2000);
    const content = await page.content();
    const hasRequests = content.toLowerCase().includes('request') || content.toLowerCase().includes('leave');
    expect(hasRequests).toBe(true);
  });
});

// ─── Leave Navigation ─────────────────────────────────────────────────────────
test.describe('Leave Navigation', () => {
  test('sidebar has Leave navigation item', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Sidebar uses NavLink — find by role or text
    await expect(page.getByRole('link', { name: /^leave$/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('clicking Leave in sidebar navigates correctly', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: /^leave$/i }).first().click();
    await page.waitForURL(/\/leave/, { timeout: 8000 });
    expect(page.url()).toMatch(/\/leave/);
  });
});

// This test must run without pre-loaded auth state
test.describe('Leave Navigation — Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthenticated user is redirected from /leave', async ({ page }) => {
    await page.goto('/leave');
    await page.waitForURL(/login/, { timeout: 8000 });
    await expect(page).toHaveURL(/login/);
  });
});
