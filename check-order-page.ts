/**
 * Check order page data for today (with existing order)
 */

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import fs from 'fs/promises';

const B2B_BASE_URL = process.env.LUNCHLAB_BASE_URL || 'https://b2b.lunchlab.me';
const COOKIES_PATH = './data/lunchlab-cookies.json';

async function login(): Promise<string> {
  const username = process.env.LUNCHLAB_USERNAME;
  const password = process.env.LUNCHLAB_PASSWORD;

  if (!username || !password) {
    throw new Error('LUNCHLAB_USERNAME and LUNCHLAB_PASSWORD must be set');
  }

  // Get CSRF token
  const csrfResponse = await axios.get(`${B2B_BASE_URL}/api/auth/csrf`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  const csrfToken = csrfResponse.data.csrfToken;
  const csrfCookies = csrfResponse.headers['set-cookie'] || [];

  // Login
  const loginData = new URLSearchParams({
    csrfToken: csrfToken,
    username: username,
    password: password,
  });

  const loginResponse = await axios.post(
    `${B2B_BASE_URL}/api/auth/callback/credentials`,
    loginData.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': csrfCookies.map(c => c.split(';')[0]).join('; '),
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      maxRedirects: 0,
      validateStatus: (status) => status === 302 || status === 200,
    }
  );

  const sessionCookies = loginResponse.headers['set-cookie'] || [];
  const allCookies = [...csrfCookies, ...sessionCookies]
    .map(c => c.split(';')[0])
    .join('; ');

  return allCookies;
}

async function checkOrderPage(orderDate: string) {
  console.log(`\nChecking order page data for ${orderDate}...\n`);

  const cookieHeader = await login();
  console.log('✅ Logged in\n');

  // Get HTML to find build ID
  const htmlResponse = await axios.get(`${B2B_BASE_URL}/console/order?date=${orderDate}`, {
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
  const dataUrl = `${B2B_BASE_URL}/_next/data/${buildId}/console/order.json?date=${orderDate}`;
  const dataResponse = await axios.get(dataUrl, {
    headers: {
      'Cookie': cookieHeader,
      'Accept': 'application/json',
    },
  });

  const pageData = dataResponse.data.pageProps;

  console.log('\n📦 Full pageProps:');
  console.log(JSON.stringify(pageData, null, 2));

  console.log('\n📍 Delivery Schedule:');
  console.log(JSON.stringify(pageData.deliverySchedule, null, 2));

  console.log('\n📍 Orders (if exists):');
  console.log(JSON.stringify(pageData.orders, null, 2));
}

// Check multiple dates
async function main() {
  const dates = ['2025-11-06', '2025-11-07', '2025-11-08'];

  for (const date of dates) {
    try {
      await checkOrderPage(date);
      console.log('\n' + '='.repeat(80) + '\n');
    } catch (error: any) {
      console.error(`Error for ${date}:`, error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
