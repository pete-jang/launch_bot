/**
 * Opens browser with DevTools for manual API inspection
 */

import dotenv from 'dotenv';
dotenv.config();

import puppeteer from 'puppeteer';
import fs from 'fs/promises';

const LUNCHLAB_BASE_URL = process.env.LUNCHLAB_BASE_URL || 'https://b2b.lunchlab.me';
const COOKIES_PATH = './data/lunchlab-cookies.json';

async function loadCookies(page: any): Promise<boolean> {
  try {
    const cookiesString = await fs.readFile(COOKIES_PATH, 'utf-8');
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);
    console.log('✅ Loaded saved cookies');
    return true;
  } catch (error) {
    console.log('❌ No saved cookies found');
    return false;
  }
}

async function openBrowserForInspection() {
  console.log('🌐 Opening browser with DevTools...\n');

  const browser = await puppeteer.launch({
    headless: false,
    devtools: true, // Open DevTools automatically
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await loadCookies(page);

  // Find a date with available ordering
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 19);
  const dateStr = futureDate.toISOString().split('T')[0];

  console.log('📋 Manual API Inspection Instructions:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('1. ✅ Browser and DevTools are now open');
  console.log('2. 🔍 In DevTools, go to the "Network" tab');
  console.log('3. ☑️  Check "Preserve log" (important!)');
  console.log('4. 🔽 Filter by "Fetch/XHR" or "All"');
  console.log('5. 🧹 Click "Clear" to start fresh');
  console.log('');
  console.log('Now perform these actions:');
  console.log('  a) Click the + button to add menu items (3 times)');
  console.log('  b) Click the "주문하기" (Order) button');
  console.log('  c) Watch the Network tab for new requests');
  console.log('');
  console.log('Look for:');
  console.log('  • POST requests to /api/... or /trpc/...');
  console.log('  • Any requests with order data in payload');
  console.log('  • Requests that happen right after clicking submit');
  console.log('');
  console.log('For each relevant API call, note:');
  console.log('  - Request URL');
  console.log('  - Request Method (GET/POST/PUT)');
  console.log('  - Request Headers (especially Authorization, Cookie)');
  console.log('  - Request Payload/Body');
  console.log('  - Response');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📅 Navigating to order page (${dateStr})...\n`);

  await page.goto(`${LUNCHLAB_BASE_URL}/console/order?date=${dateStr}`, {
    waitUntil: 'networkidle2',
  });

  console.log('✅ Page loaded! Start inspecting in the DevTools Network tab.\n');
  console.log('Press Ctrl+C in this terminal when done.');

  // Keep the browser open
  await new Promise(() => {});
}

openBrowserForInspection()
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
