/**
 * API Traffic Analyzer
 *
 * This script opens a browser, loads saved cookies, and captures all API requests
 * during the order process to understand the API structure.
 *
 * Usage: npx ts-node analyze-api.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import puppeteer, { HTTPRequest, HTTPResponse } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

const LUNCHLAB_BASE_URL = process.env.LUNCHLAB_BASE_URL || 'https://b2b.lunchlab.me';
const COOKIES_PATH = './data/lunchlab-cookies.json';
const ANALYSIS_DIR = './data/api-analysis';

interface CapturedRequest {
  timestamp: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  postData?: string;
}

interface CapturedResponse {
  timestamp: string;
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

interface CapturedCall {
  request: CapturedRequest;
  response?: CapturedResponse;
}

const capturedCalls: CapturedCall[] = [];

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
  console.log('🔍 Starting API Analysis...\n');

  const browser = await puppeteer.launch({
    headless: false, // Keep browser visible
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: true, // Open DevTools automatically
  });

  const page = await browser.newPage();

  // Enable request/response logging
  page.on('request', (request: HTTPRequest) => {
    const url = request.url();

    // Capture ALL requests from b2b.lunchlab.me domain (except static assets)
    if (
      url.includes('b2b.lunchlab.me') &&
      !url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico|webp)$/i) &&
      !url.includes('google-analytics') &&
      !url.includes('sentry.io')
    ) {
      const capturedReq: CapturedRequest = {
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: url,
        headers: request.headers(),
        postData: request.postData(),
      };

      capturedCalls.push({
        request: capturedReq,
      });

      console.log(`📤 ${request.method()} ${url}`);
      if (capturedReq.postData) {
        console.log(`   Body: ${capturedReq.postData.substring(0, 200)}`);
      }
    }
  });

  page.on('response', async (response: HTTPResponse) => {
    const url = response.url();

    // Capture ALL responses from b2b.lunchlab.me domain (except static assets)
    if (
      url.includes('b2b.lunchlab.me') &&
      !url.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico|webp)$/i) &&
      !url.includes('google-analytics') &&
      !url.includes('sentry.io')
    ) {
      try {
        let body: string | undefined;
        const contentType = response.headers()['content-type'] || '';

        if (contentType.includes('application/json') || contentType.includes('text/')) {
          try {
            body = await response.text();
          } catch (e) {
            body = '[Could not read response body]';
          }
        }

        const capturedResp: CapturedResponse = {
          timestamp: new Date().toISOString(),
          status: response.status(),
          statusText: response.statusText(),
          url: url,
          headers: response.headers(),
          body: body,
        };

        // Find matching request
        const matchingCall = capturedCalls.find(
          call => call.request.url === url && !call.response
        );

        if (matchingCall) {
          matchingCall.response = capturedResp;
        }

        console.log(`📥 ${response.status()} ${url}`);
        if (body && body.length < 500) {
          console.log(`   Body: ${body}`);
        } else if (body) {
          console.log(`   Body: ${body.substring(0, 200)}... (${body.length} chars)`);
        }
      } catch (error) {
        console.error(`   Error capturing response: ${error}`);
      }
    }
  });

  // Load cookies
  await loadCookies(page);

  console.log('\n📋 Automating order process to capture API calls...\n');

  // Navigate to order page (use a future date to avoid already-ordered dates)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 10); // Use 10 days from now to avoid existing orders
  const targetDate = tomorrow.toISOString().split('T')[0];

  console.log(`📅 Navigating to order page for ${targetDate}...`);
  await page.goto(`${LUNCHLAB_BASE_URL}/console/order?date=${targetDate}`, {
    waitUntil: 'networkidle2',
  });

  console.log('✅ Order page loaded\n');

  // Wait for form to load
  await page.waitForSelector('form', { timeout: 10000 }).catch(() => {
    console.log('⚠️  Form not found, checking if we need to click modify button...');
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('🔘 Step 1: Clicking + button to add menu items...');

  // Find and click the + button for 가정식 (first menu item)
  const addButtons = await page.$$('button svg[data-testid="AddIcon"]');

  if (addButtons.length > 0) {
    console.log(`   Found ${addButtons.length} add buttons`);

    // Click + button for 가정식 3 times (minimum order)
    for (let i = 0; i < 3; i++) {
      const buttonElement = await page.evaluateHandle(
        (svg) => svg.closest('button'),
        addButtons[0]
      );
      await (buttonElement as any).click();
      console.log(`   Clicked + button ${i + 1}/3`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } else {
    console.log('   ⚠️  No add buttons found');
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('\n🔘 Step 2: Checking if submit button is enabled...');

  const submitButtonEnabled = await page.evaluate(() => {
    // @ts-ignore
    const submitButton = document.querySelector('button[type="submit"]');
    // @ts-ignore
    return submitButton && !submitButton.hasAttribute('disabled');
  });

  console.log(`   Submit button enabled: ${submitButtonEnabled}`);

  if (submitButtonEnabled) {
    console.log('\n🔘 Step 3: Clicking submit button...');

    // Take screenshot before submission
    await page.screenshot({ path: `${ANALYSIS_DIR}/before-submit.png`, fullPage: true });

    await page.click('button[type="submit"]');
    console.log('   Submit button clicked!');

    // Wait for API response
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take screenshot after submission
    await page.screenshot({ path: `${ANALYSIS_DIR}/after-submit.png`, fullPage: true });

    // Check for success/error messages
    const pageStatus = await page.evaluate(() => {
      // @ts-ignore
      const body = document.body.innerText;
      // @ts-ignore
      const url = window.location.href;
      // @ts-ignore
      const alerts = Array.from(document.querySelectorAll('[role="alert"], .MuiAlert-message, .error, .success'));
      // @ts-ignore
      return {
        url,
        // @ts-ignore
        alerts: alerts.map(el => el.textContent),
        bodySnippet: body.substring(0, 500)
      };
    });

    console.log('\n📄 Page status after submission:');
    console.log(`   URL: ${pageStatus.url}`);
    console.log(`   Alerts: ${JSON.stringify(pageStatus.alerts)}`);
    console.log(`   Screenshots saved to: ${ANALYSIS_DIR}`);
  } else {
    console.log('   ⚠️  Submit button not enabled, skipping submission');
  }

  console.log('\n⏳ Waiting a bit more for any delayed API calls...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Save captured data
  await fs.mkdir(ANALYSIS_DIR, { recursive: true });

  const analysisPath = path.join(ANALYSIS_DIR, `api-calls-${Date.now()}.json`);
  await fs.writeFile(
    analysisPath,
    JSON.stringify(capturedCalls, null, 2)
  );

  console.log(`\n✅ Captured ${capturedCalls.length} API calls`);
  console.log(`📁 Saved to: ${analysisPath}`);

  // Print summary
  console.log('\n📊 Summary of API Endpoints:');
  const uniqueEndpoints = new Set(
    capturedCalls.map(call => `${call.request.method} ${new URL(call.request.url).pathname}`)
  );
  uniqueEndpoints.forEach(endpoint => {
    console.log(`   - ${endpoint}`);
  });

  await browser.close();
  console.log('\n✅ Analysis complete!');
}

analyzeAPI()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
