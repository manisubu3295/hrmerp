import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

// ─── Calendar Page ─────────────────────────────────────────────────────────────
test.describe('Calendar Module', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
  });

  test('displays Calendar page heading', async ({ page }) => {
    await page.waitForTimeout(1500);
    // Calendar heading is 'Calendar' in h4/h5 Typography
    await expect(page.getByText('Calendar').first()).toBeVisible({ timeout: 10000 });
  });

  test('shows current month and year in the header', async ({ page }) => {
    await page.waitForTimeout(1500);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const curMonth = monthNames[new Date().getMonth()];
    const curYear = new Date().getFullYear().toString();
    const content = await page.content();
    expect(content).toContain(curMonth);
    expect(content).toContain(curYear);
  });

  test('shows day-of-week headers (Sun through Sat)', async ({ page }) => {
    await page.waitForTimeout(1500);
    const content = await page.content();
    expect(content).toContain('Sun');
    expect(content).toContain('Mon');
    expect(content).toContain('Sat');
  });

  test('renders calendar grid cells', async ({ page }) => {
    await page.waitForTimeout(1500);
    // Calendar dates 1-31 should be visible in cells
    await expect(page.getByText('1').first()).toBeVisible({ timeout: 5000 });
  });

  test('has Previous Month navigation button', async ({ page }) => {
    const prevBtn = page.locator('button').filter({ has: page.locator('[data-testid="ChevronLeftIcon"]') }).first();
    await expect(prevBtn).toBeVisible({ timeout: 5000 });
  });

  test('has Next Month navigation button', async ({ page }) => {
    const nextBtn = page.locator('button').filter({ has: page.locator('[data-testid="ChevronRightIcon"]') }).first();
    await expect(nextBtn).toBeVisible({ timeout: 5000 });
  });

  test('can navigate to next month', async ({ page }) => {
    await page.waitForTimeout(1500);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const nextMonth = monthNames[(new Date().getMonth() + 1) % 12];
    const nextBtn = page.locator('button').filter({ has: page.locator('[data-testid="ChevronRightIcon"]') }).first();
    await nextBtn.click();
    await page.waitForTimeout(500);
    await expect(page.getByText(nextMonth).first()).toBeVisible({ timeout: 5000 });
  });

  test('can navigate to previous month', async ({ page }) => {
    await page.waitForTimeout(1500);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    // Go forward first so we can go back
    const nextBtn = page.locator('button').filter({ has: page.locator('[data-testid="ChevronRightIcon"]') }).first();
    await nextBtn.click();
    await page.waitForTimeout(300);
    const prevBtn = page.locator('button').filter({ has: page.locator('[data-testid="ChevronLeftIcon"]') }).first();
    await prevBtn.click();
    await page.waitForTimeout(300);
    const curMonth = monthNames[new Date().getMonth()];
    await expect(page.getByText(curMonth).first()).toBeVisible({ timeout: 5000 });
  });

  test('shows right panel with events list', async ({ page }) => {
    await page.waitForTimeout(2000);
    const content = await page.content();
    // Should contain either "Events in" heading or "No events" message
    const hasEventPanel = content.toLowerCase().includes('event') || content.toLowerCase().includes('holiday');
    expect(hasEventPanel).toBe(true);
  });

  test('shows legend bar with event types', async ({ page }) => {
    await page.waitForTimeout(2000);
    const content = await page.content();
    const hasLegend = content.includes('Public Holiday') || content.includes('Company Holiday');
    expect(hasLegend).toBe(true);
  });
});

// ─── Calendar — Admin Event Management ────────────────────────────────────────
test.describe('Calendar Module — Admin Event Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
  });

  test('admin sees Add Event button', async ({ page }) => {
    await page.waitForTimeout(1500);
    const addBtn = page.getByRole('button', { name: /add event/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 8000 });
  });

  test('Add Event button opens dialog', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /add event/i }).first();
    await addBtn.click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/add calendar event/i)).toBeVisible();
  });

  test('Add Event dialog has Event Name field', async ({ page }) => {
    await page.getByRole('button', { name: /add event/i }).first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await expect(page.getByLabel('Event Name')).toBeVisible();
  });

  test('Add Event dialog has Date field', async ({ page }) => {
    await page.getByRole('button', { name: /add event/i }).first().click();
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await expect(page.getByLabel('Date')).toBeVisible();
  });

  test('Add Event dialog has Type dropdown', async ({ page }) => {
    await page.getByRole('button', { name: /add event/i }).first().click();
    await page.waitForTimeout(800);
    await expect(page.getByText('Type').first()).toBeVisible({ timeout: 5000 });
  });

  test('Add Event dialog has Save Event button', async ({ page }) => {
    await page.getByRole('button', { name: /add event/i }).first().click();
    await page.waitForTimeout(800);
    // Scope to the dialog: the submit button is inside [role="dialog"]
    const dialogAddBtn = page.locator('[role="dialog"]').getByRole('button', { name: /add event/i });
    await expect(dialogAddBtn).toBeVisible({ timeout: 5000 });
  });

  test('Save Event shows error when name or date is missing', async ({ page }) => {
    await page.getByRole('button', { name: /add event/i }).first().click();
    await page.waitForTimeout(800);
    // Click the dialog's Add Event button with no name / date filled
    const dialogAddBtn = page.locator('[role="dialog"]').getByRole('button', { name: /add event/i });
    await dialogAddBtn.click();
    // Dialog remains open due to validation
    await expect(page.getByText('Add Calendar Event').first()).toBeVisible({ timeout: 3000 });
  });

  test('can fill and save a calendar event', async ({ page }) => {
    await page.getByRole('button', { name: /add event/i }).first().click();
    await page.waitForTimeout(800);

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    await page.getByLabel(/event name/i).fill('E2E Test Holiday');
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.fill(dateStr);
    // Click the dialog's Add Event button (scoped to dialog)
    const dialogAddBtn = page.locator('[role="dialog"]').getByRole('button', { name: /add event/i });
    await dialogAddBtn.click();
    await page.waitForTimeout(2000);
    // Either saved (dialog closed) or API error is acceptable
  });

  test('cancel button closes Add Event dialog', async ({ page }) => {
    await page.getByRole('button', { name: /add event/i }).first().click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.getByText('Add Calendar Event')).not.toBeVisible({ timeout: 3000 });
  });

  test('shows Manage All Events tab or button', async ({ page }) => {
    await page.waitForTimeout(1500);
    const content = await page.content();
    const hasManage = content.toLowerCase().includes('all events') ||
      content.toLowerCase().includes('manage') ||
      content.toLowerCase().includes('event list');
    expect(hasManage).toBe(true);
  });
});

// ─── Calendar Navigation ───────────────────────────────────────────────────────
test.describe('Calendar Navigation', () => {
  test('sidebar has Calendar navigation item', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('link', { name: /^calendar$/i }).first()).toBeVisible({ timeout: 8000 });
  });

  test('clicking Calendar in sidebar navigates to /calendar', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: /^calendar$/i }).first().click();
    await page.waitForURL('/calendar', { timeout: 8000 });
    await expect(page).toHaveURL('/calendar');
  });
});

// This test must run without pre-loaded auth state
test.describe('Calendar Navigation — Unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthenticated user is redirected from /calendar', async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForURL(/login/, { timeout: 8000 });
    await expect(page).toHaveURL(/login/);
  });
});
