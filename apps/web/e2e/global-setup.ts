import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const AUTH_FILE = 'e2e/.auth/user.json';

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? 'http://localhost:3000';
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`${baseURL}/login`);
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log('✓ Frontend is accessible');
  } catch {
    console.error('Frontend not running. Start with: npm run dev');
    process.exit(1);
  }

  try {
    const res = await page.request.get('http://localhost:4000/health');
    console.log('✓ API is accessible (status:', res.status(), ')');
  } catch {
    console.error('API not running. Start with: npm run dev in apps/api');
    process.exit(1);
  }

  // Log in once and save the auth state so all tests reuse it (avoids rate-limiter)
  await page.locator('input[type="email"]').fill('admin@aadhirai.com');
  await page.locator('input[type="password"]').fill('Admin@123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(`${baseURL}/dashboard`, { timeout: 15000 });
  await page.waitForTimeout(500); // let Zustand store hydrate

  const dir = path.dirname(AUTH_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
  console.log('✓ Auth state saved to', AUTH_FILE);

  await browser.close();
}
