import { chromium } from '@playwright/test';

export default async function globalSetup() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    console.log('✓ Frontend is accessible');
  } catch {
    console.error('Frontend not running. Start with: npm run dev');
    process.exit(1);
  }

  try {
    const res = await page.request.get('http://localhost:4000/api/v1/auth/profile');
    console.log('✓ API is accessible (status:', res.status(), ')');
  } catch {
    console.error('API not running. Start with: npm run dev in apps/api');
    process.exit(1);
  }

  await browser.close();
}
