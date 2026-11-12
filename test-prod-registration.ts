import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));

  console.log('Navigating to local production server...');
  await page.goto('http://localhost:3000/sign-up');

  console.log('Filling out registration form...');
  const randomSuffix = Math.floor(Math.random() * 1000000);
  const email = `testuser_${randomSuffix}@example.com`;
  const username = `testuser_${randomSuffix}`;

  await page.fill('input[name="name"]', `Test User ${randomSuffix}`);
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'Password123!');
  await page.fill('input[name="confirmPassword"]', 'Password123!');
  await page.check('input[name="terms"]');

  console.log('Submitting form...');
  await page.click('button[type="submit"]');

  console.log('Waiting for navigation to /verify-email...');
  try {
    await page.waitForURL('**/verify-email?status=sent', { timeout: 15000 });
    console.log('SUCCESS: Account created and verification step reached.');
  } catch {
    console.error('FAILED: Did not reach the email verification step within the timeout.');
    const errorText = await page.evaluate(() => document.body.innerText);
    console.error('Page text:', errorText);
    process.exit(1);
  }

  await browser.close();
})();
