/**
 * Find real product IDs from page source
 */

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';
import fs from 'fs/promises';

const B2B_BASE_URL = process.env.LUNCHLAB_BASE_URL || 'https://b2b.lunchlab.me';
const COOKIES_PATH = './data/lunchlab-cookies.json';

async function findProductIds() {
  // Load cookies
  const cookiesString = await fs.readFile(COOKIES_PATH, 'utf-8');
  const cookies = JSON.parse(cookiesString);
  const cookieHeader = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ');

  // Get HTML
  const htmlResponse = await axios.get(`${B2B_BASE_URL}/console/order?date=2025-11-25`, {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0',
    },
  });

  const html = htmlResponse.data;

  // Extract __NEXT_DATA__ script
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);

  if (!match) {
    throw new Error('Could not find __NEXT_DATA__');
  }

  const nextData = JSON.parse(match[1]);
  const pageProps = nextData.props.pageProps;

  console.log('🔍 Full delivery schedule data:');
  console.log(JSON.stringify(pageProps.deliverySchedule, null, 2));

  // Look for product information in stocks
  if (pageProps.deliverySchedule?.stocks) {
    console.log('\n📦 Stock details:');
    pageProps.deliverySchedule.stocks.forEach((stock: any, index: number) => {
      console.log(`\nStock ${index}:`);
      console.log(JSON.stringify(stock, null, 2));
    });
  }

  // Check if there's product info elsewhere
  console.log('\n🔍 Looking for "rec" or "60b98b1c" patterns in HTML...');
  const recMatches = html.match(/rec[A-Za-z0-9]{10,}/g) || [];
  const uuidMatches = html.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) || [];

  console.log('Found "rec..." patterns:', [...new Set(recMatches)]);
  console.log('Found UUID patterns:', [...new Set(uuidMatches)]);
}

findProductIds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
