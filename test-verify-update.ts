/**
 * Verify order update - check if the update was successful
 * Usage: npx ts-node test-verify-update.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import puppeteer from 'puppeteer';
import fs from 'fs/promises';

async function main() {
  console.log('🔍 Verifying order update...\n');

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Load cookies
  try {
    const cookiesString = await fs.readFile('./data/lunchlab-cookies.json', 'utf-8');
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);
    console.log('✅ Loaded saved cookies');
  } catch (error) {
    console.log('⚠️  No saved cookies found');
  }

  // Navigate to order page
  const orderDate = '2025-11-07';
  console.log(`Navigating to order page for ${orderDate}...`);

  await page.goto(`https://b2b.lunchlab.me/console/order?date=${orderDate}`, {
    waitUntil: 'networkidle2',
  });

  // Wait for page to load
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Take screenshot
  await page.screenshot({
    path: `screenshots/verify-order-${orderDate}.png`,
    fullPage: true
  });
  console.log(`✅ Screenshot saved: screenshots/verify-order-${orderDate}.png`);

  // Extract order quantities
  const orderInfo = await page.evaluate(() => {
    // @ts-ignore
    const rows = Array.from(document.querySelectorAll('table tr'));
    const orders: any = {};

    // @ts-ignore
    rows.forEach(row => {
      // @ts-ignore
      const cells = row.querySelectorAll('td');
      if (cells.length >= 3) {
        // @ts-ignore
        const menuName = cells[0]?.textContent?.trim();
        // @ts-ignore
        const quantity = cells[2]?.textContent?.trim();

        if (menuName && quantity) {
          orders[menuName] = parseInt(quantity) || 0;
        }
      }
    });

    return orders;
  });

  console.log('\n📊 Current order:');
  console.log(JSON.stringify(orderInfo, null, 2));

  if (orderInfo['프레시밀'] === 2) {
    console.log('\n✅ Order update verified! 프레시밀 is now 2');
  } else {
    console.log(`\n⚠️  프레시밀 is still ${orderInfo['프레시밀']}, expected 2`);
  }

  await browser.close();
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
