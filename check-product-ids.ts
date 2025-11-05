/**
 * Check product IDs from order page
 */

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import fs from 'fs/promises';

const B2B_BASE_URL = process.env.LUNCHLAB_BASE_URL || 'https://b2b.lunchlab.me';
const COOKIES_PATH = './data/lunchlab-cookies.json';

async function checkProductIds() {
  // Load cookies
  const cookiesString = await fs.readFile(COOKIES_PATH, 'utf-8');
  const cookies = JSON.parse(cookiesString);
  const cookieHeader = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');

  // Get HTML to find build ID
  const htmlResponse = await axios.get(`${B2B_BASE_URL}/console/order?date=2025-11-25`, {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0',
    },
  });

  const buildIdMatch = htmlResponse.data.match(/"buildId":"([^"]+)"/);
  if (!buildIdMatch) throw new Error('Could not find build ID');

  const buildId = buildIdMatch[1];
  console.log('Build ID:', buildId);

  // Fetch order page data
  const dataUrl = `${B2B_BASE_URL}/_next/data/${buildId}/console/order.json?date=2025-11-25`;
  const dataResponse = await axios.get(dataUrl, {
    headers: {
      'Cookie': cookieHeader,
      'Accept': 'application/json',
    },
  });

  const pageData = dataResponse.data.pageProps;

  console.log('\n📦 Delivery Schedule:');
  console.log(JSON.stringify(pageData.deliverySchedule, null, 2));

  console.log('\n📍 Addresses:');
  console.log(JSON.stringify(pageData.addresses, null, 2));
}

checkProductIds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
