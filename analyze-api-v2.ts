/**
 * API Traffic Analyzer v2
 * Uses Chrome DevTools Protocol directly to capture ALL network traffic
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

async function analyzeAPI() {
  console.log('🔍 Starting API Analysis v2 (CDP-based)...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Enable CDP Network domain
  const client = await page.createCDPSession();
  await client.send('Network.enable');

  const allRequests: any[] = [];

  // Listen to ALL network events via CDP
  client.on('Network.requestWillBeSent', (params) => {
    if (params.request.url.includes('b2b.lunchlab.me')) {
      console.log(`📤 ${params.request.method} ${params.request.url}`);
      allRequests.push({
        requestId: params.requestId,
        method: params.request.method,
        url: params.request.url,
        headers: params.request.headers,
        postData: params.request.postData,
        timestamp: params.timestamp,
      });
    }
  });

  client.on('Network.responseReceived', (params) => {
    if (params.response.url.includes('b2b.lunchlab.me')) {
      console.log(`📥 ${params.response.status} ${params.response.url}`);

      const req = allRequests.find(r => r.requestId === params.requestId);
      if (req) {
        req.response = {
          status: params.response.status,
          headers: params.response.headers,
          mimeType: params.response.mimeType,
        };
      }
    }
  });

  // Load cookies
  await loadCookies(page);

  console.log('\n📋 Automating order process...\n');

  // Navigate to order page
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 10);
  const dateStr = targetDate.toISOString().split('T')[0];

  console.log(`📅 Navigating to ${dateStr}...`);
  await page.goto(`${LUNCHLAB_BASE_URL}/console/order?date=${dateStr}`, {
    waitUntil: 'networkidle2',
  });

  console.log('✅ Page loaded\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('🔘 Clicking + button 3 times...');
  const addButtons = await page.$$('button svg[data-testid="AddIcon"]');

  if (addButtons.length > 0) {
    for (let i = 0; i < 3; i++) {
      const btn = await page.evaluateHandle((svg) => svg.closest('button'), addButtons[0]);
      await (btn as any).click();
      console.log(`   Clicked ${i + 1}/3`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n🔘 Clicking submit button...');
  console.log('   ⚠️  Preventing navigation to capture API...');

  // Intercept and prevent navigation
  await page.evaluateOnNewDocument(() => {
    // @ts-ignore
    const originalPushState = window.history.pushState;
    // @ts-ignore
    window.history.pushState = function(...args) {
      console.log('Navigation prevented:', args);
      // Don't actually navigate
    };
  });

  await page.click('button[type="submit"]');
  console.log('   Submit clicked, waiting for API response...');

  // Wait longer for API
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log(`\n✅ Captured ${allRequests.length} requests`);

  // Save to file
  await fs.mkdir('./data/api-analysis', { recursive: true });
  await fs.writeFile(
    `./data/api-analysis/cdp-requests-${Date.now()}.json`,
    JSON.stringify(allRequests, null, 2)
  );

  // Print POST requests
  const postRequests = allRequests.filter(r => r.method === 'POST');
  console.log(`\n📊 Found ${postRequests.length} POST requests:`);
  postRequests.forEach(r => {
    console.log(`   - ${r.method} ${r.url}`);
    if (r.postData) {
      console.log(`     Body: ${r.postData.substring(0, 200)}`);
    }
  });

  await browser.close();
  console.log('\n✅ Done!');
}

analyzeAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
