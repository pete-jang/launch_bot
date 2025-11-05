/**
 * Analyze login API calls
 */

import dotenv from 'dotenv';
dotenv.config();

import puppeteer from 'puppeteer';

const LUNCHLAB_BASE_URL = process.env.LUNCHLAB_BASE_URL || 'https://b2b.lunchlab.me';

async function analyzeLoginAPI() {
  console.log('🌐 Opening browser to analyze login API...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // Enable request interception to log API calls
  await page.setRequestInterception(true);

  const apiCalls: any[] = [];

  page.on('request', (request) => {
    const url = request.url();
    const method = request.method();

    // Log all requests
    if (url.includes('api') || url.includes('auth') || method === 'POST') {
      console.log(`\n📤 ${method} ${url}`);

      if (request.postData()) {
        console.log('   Body:', request.postData());
      }

      apiCalls.push({
        method,
        url,
        headers: request.headers(),
        postData: request.postData(),
      });
    }

    request.continue();
  });

  page.on('response', async (response) => {
    const url = response.url();
    const method = response.request().method();

    if (url.includes('api') || url.includes('auth') || method === 'POST') {
      console.log(`\n📥 ${response.status()} ${method} ${url}`);

      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          console.log('   Response:', JSON.stringify(data, null, 2));
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
  });

  // Navigate to login page
  await page.goto(`${LUNCHLAB_BASE_URL}/auth/sign-in`, {
    waitUntil: 'networkidle2',
  });

  console.log('\n✅ Please log in manually in the browser...');
  console.log('   All API calls will be logged here');
  console.log('   Press ENTER when done\n');

  // Wait for user to press Enter
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });

  console.log('\n\n📋 Summary of API calls:');
  console.log(JSON.stringify(apiCalls, null, 2));

  await browser.close();
}

analyzeLoginAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
