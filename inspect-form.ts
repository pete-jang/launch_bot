/**
 * Inspect form structure to understand how orders are submitted
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
    return true;
  } catch (error) {
    return false;
  }
}

async function inspectForm() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await loadCookies(page);

  // Try different dates to find one with an active form
  const dates = [
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days ahead
    new Date(Date.now() + 20 * 24 * 60 * 60 * 1000), // 20 days ahead
    new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // 25 days ahead
  ];

  for (const date of dates) {
    const dateStr = date.toISOString().split('T')[0];
    console.log(`\n📅 Trying ${dateStr}...`);

    await page.goto(`${LUNCHLAB_BASE_URL}/console/order?date=${dateStr}`, {
      waitUntil: 'networkidle2',
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if form exists
    const formInfo = await page.evaluate(() => {
      // @ts-ignore
      const form = document.querySelector('form');
      if (!form) return null;

      return {
        // @ts-ignore
        action: form.action,
        // @ts-ignore
        method: form.method,
        // @ts-ignore
        enctype: form.enctype,
        // @ts-ignore
        hasSubmitButton: !!document.querySelector('button[type="submit"]'),
        // @ts-ignore
        formHTML: form.outerHTML.substring(0, 500),
      };
    });

    if (formInfo) {
      console.log('✅ Found active order form!');
      console.log('Form details:', JSON.stringify(formInfo, null, 2));

      // Inspect network listeners
      const networkListeners = await page.evaluate(() => {
        // @ts-ignore
        const form = document.querySelector('form');
        // @ts-ignore
        const submitBtn = document.querySelector('button[type="submit"]');

        return {
          // @ts-ignore
          formHasSubmitListener: !!form?.onsubmit,
          // @ts-ignore
          buttonHasClickListener: !!submitBtn?.onclick,
        };
      });

      console.log('Event listeners:', networkListeners);

      // Try to capture form submission
      console.log('\n🔍 Setting up request interception...');

      await page.setRequestInterception(true);
      const capturedRequests: any[] = [];

      page.on('request', (request) => {
        if (request.url().includes('b2b.lunchlab.me') && request.method() === 'POST') {
          console.log(`📤 POST ${request.url()}`);
          capturedRequests.push({
            url: request.url(),
            method: request.method(),
            postData: request.postData(),
            headers: request.headers(),
          });
        }
        request.continue();
      });

      // Click + buttons and submit
      console.log('\n🔘 Simulating order...');
      const addButtons = await page.$$('button svg[data-testid="AddIcon"]');

      if (addButtons.length > 0) {
        for (let i = 0; i < 3; i++) {
          const btn = await page.evaluateHandle((svg) => svg.closest('button'), addButtons[0]);
          await (btn as any).click();
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        console.log('   Added 3 items');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('   Clicking submit...');
      await page.click('button[type="submit"]');

      // Wait for navigation or API call
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log(`\n📊 Captured ${capturedRequests.length} POST requests:`);
      capturedRequests.forEach(r => {
        console.log(`   - ${r.url}`);
        console.log(`     Body: ${r.postData}`);
      });

      if (capturedRequests.length === 0) {
        console.log('\n❓ No POST requests captured.');
        console.log('   This suggests the form uses:');
        console.log('   1. GET request navigation (form action with GET method)');
        console.log('   2. Next.js Server Actions');
        console.log('   3. Client-side state management without API');

        // Check current URL
        const currentUrl = page.url();
        console.log(`\n🔗 Current URL after submit: ${currentUrl}`);
      }

      await fs.writeFile(
        './data/captured-post-requests.json',
        JSON.stringify(capturedRequests, null, 2)
      );

      break;
    } else {
      console.log('   ⚠️  No form found (already ordered?)');
    }
  }

  await browser.close();
  console.log('\n✅ Inspection complete!');
}

inspectForm()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
