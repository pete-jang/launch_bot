/**
 * Find the correct API endpoint to fetch existing orders
 */
import puppeteer from 'puppeteer';
import fs from 'fs';

const COOKIES_FILE = 'lunchlab-cookies.json';

async function findOrderAPI() {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
  });

  const page = await browser.newPage();

  // Load saved cookies if available
  if (fs.existsSync(COOKIES_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
    await page.setCookie(...cookies);
    console.log('✅ Loaded saved cookies');
  }

  // Enable request interception to log all API calls
  await page.setRequestInterception(true);

  const apiCalls: any[] = [];

  page.on('request', (request) => {
    const url = request.url();

    // Log API calls to core-service
    if (url.includes('api.lunchlab.me') || url.includes('core-service')) {
      apiCalls.push({
        method: request.method(),
        url: url,
        headers: request.headers(),
        postData: request.postData(),
      });

      console.log(`📤 ${request.method()} ${url}`);
    }

    request.continue();
  });

  page.on('response', async (response) => {
    const url = response.url();

    if (url.includes('api.lunchlab.me') || url.includes('core-service')) {
      try {
        const status = response.status();
        console.log(`📥 ${status} ${response.request().method()} ${url}`);

        if (url.includes('/order')) {
          const text = await response.text();
          console.log('   Response:', text.substring(0, 500));
        }
      } catch (e) {
        // Ignore
      }
    }
  });

  console.log('\n📋 Instructions:');
  console.log('1. Navigate to order page (if not logged in, log in first)');
  console.log('2. Look for existing orders on the page');
  console.log('3. Try clicking "수정" button if available');
  console.log('4. Watch the console for API calls\n');
  console.log('Press Ctrl+C when done\n');

  // Navigate to order page
  await page.goto('https://b2b.lunchlab.me/console/order?date=2025-11-05');

  // Wait indefinitely
  await new Promise(() => {});
}

findOrderAPI().catch(console.error);
