/**
 * Manual login and cookie extraction script
 * Usage: npx ts-node extract-cookies.ts
 *
 * This script opens a browser where you can manually log in,
 * then it saves the cookies for automated use.
 */

import dotenv from 'dotenv';
dotenv.config();

import puppeteer from 'puppeteer';
import fs from 'fs/promises';

const LUNCHLAB_BASE_URL = process.env.LUNCHLAB_BASE_URL || 'https://b2b.lunchlab.me';
const COOKIES_PATH = './data/lunchlab-cookies.json';

async function extractCookies() {
  console.log('🌐 Opening browser for manual login...\n');
  console.log('Instructions:');
  console.log('1. A browser window will open');
  console.log('2. Please log in manually to Lunchlab');
  console.log('3. After successful login, press ENTER in this terminal');
  console.log('4. Cookies will be saved for automated use\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Navigate to login page
  await page.goto(`${LUNCHLAB_BASE_URL}/auth/sign-in`, {
    waitUntil: 'networkidle2',
  });

  console.log('✅ Browser opened. Please log in manually...');
  console.log('   Press ENTER when you have successfully logged in');

  // Wait for user to press Enter
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });

  // Get current URL
  const currentUrl = page.url();
  console.log('\n📍 Current URL:', currentUrl);

  // Check if logged in
  if (currentUrl.includes('/auth/sign-in')) {
    console.log('⚠️  Warning: Still on login page. Login may not have succeeded.');
    console.log('   Continuing anyway to save cookies...');
  } else {
    console.log('✅ Login appears successful!');
  }

  // Save cookies
  const cookies = await page.cookies();
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));

  console.log(`\n✅ Cookies saved to: ${COOKIES_PATH}`);
  console.log(`   Total cookies: ${cookies.length}`);

  // Show important cookies
  const importantCookies = cookies.filter(c =>
    c.name.includes('session') ||
    c.name.includes('token') ||
    c.name.includes('auth') ||
    c.name.startsWith('next-auth')
  );

  if (importantCookies.length > 0) {
    console.log('\n📋 Important cookies found:');
    importantCookies.forEach(c => {
      console.log(`   - ${c.name}: ${c.value.substring(0, 30)}...`);
    });
  }

  await browser.close();
  console.log('\n✅ Done! You can now use the automated login.');
}

extractCookies()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
