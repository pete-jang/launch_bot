/**
 * Test script to find the correct way to get existing order ID
 */
import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

const API_BASE_URL = 'https://api.lunchlab.me/b2b/core-service';
const ORDER_API_BASE_URL = 'https://api.order.lunchlab.me/b2b';
const B2B_BASE_URL = 'https://b2b.lunchlab.me';

async function login() {
  const username = process.env.LUNCHLAB_USERNAME;
  const password = process.env.LUNCHLAB_PASSWORD;

  // Get CSRF token
  const csrfResponse = await axios.get(`${B2B_BASE_URL}/api/auth/csrf`);
  const csrfToken = csrfResponse.data.csrfToken;
  const csrfCookies = csrfResponse.headers['set-cookie'] || [];

  // Login
  const loginData = new URLSearchParams({
    csrfToken: csrfToken,
    username: username!,
    password: password!,
  });

  const loginResponse = await axios.post(
    `${B2B_BASE_URL}/api/auth/callback/credentials`,
    loginData.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': csrfCookies.map(c => c.split(';')[0]).join('; '),
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

async function getToken(cookieHeader: string) {
  const response = await axios.get(`${B2B_BASE_URL}/api/auth/token`, {
    headers: {
      'Cookie': cookieHeader,
    },
  });
  return response.data;
}

async function testGetOrderId() {
  console.log('🔐 Logging in...');
  const cookies = await login();
  console.log('✅ Login successful\n');

  console.log('🔑 Getting auth token...');
  const token = await getToken(cookies);
  console.log('✅ Got token\n');

  const mealDate = '2025-11-06';

  // Test 1: Try history API
  console.log('📋 Test 1: Trying history API...');
  try {
    const historyResponse = await axios.get(`${API_BASE_URL}/order/history`, {
      params: {
        startDate: mealDate,
        endDate: mealDate,
      },
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    console.log('✅ History API response:', JSON.stringify(historyResponse.data, null, 2));
  } catch (error: any) {
    console.log('❌ History API failed:', error.response?.status, error.response?.data);
  }

  console.log('\n');

  // Test 2: Try correct order API endpoint (api.order.lunchlab.me)
  console.log('📋 Test 2: Trying correct order API (api.order.lunchlab.me)...');
  try {
    const orderResponse = await axios.get(`${ORDER_API_BASE_URL}/order`, {
      params: {
        date: mealDate,
        'with[]': 'address',
      },
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    console.log('✅ Order API response:', JSON.stringify(orderResponse.data, null, 2));
  } catch (error: any) {
    console.log('❌ Order API failed:', error.response?.status, error.response?.data);
  }

  console.log('\n');

  // Test 3: Try page data
  console.log('📋 Test 3: Checking page data...');
  try {
    const htmlResponse = await axios.get(`${B2B_BASE_URL}/console/order?date=${mealDate}`, {
      headers: {
        'Cookie': cookies,
      },
    });

    const buildIdMatch = htmlResponse.data.match(/"buildId":"([^"]+)"/);
    const buildId = buildIdMatch[1];

    const dataUrl = `${B2B_BASE_URL}/_next/data/${buildId}/console/order.json?date=${mealDate}`;
    const dataResponse = await axios.get(dataUrl, {
      headers: {
        'Cookie': cookies,
      },
    });

    const pageData = dataResponse.data.pageProps;
    console.log('✅ Page data keys:', Object.keys(pageData));

    // Check all possible fields
    const possibleFields = ['order', 'currentOrder', 'existingOrder', 'orderData', 'data', 'myOrder'];
    for (const field of possibleFields) {
      if (pageData[field]) {
        console.log(`\n📌 Found field "${field}":`, JSON.stringify(pageData[field], null, 2).substring(0, 500));
      }
    }

    // Also log the full structure if it's small enough
    const fullData = JSON.stringify(pageData, null, 2);
    if (fullData.length < 3000) {
      console.log('\n📄 Full page data:', fullData);
    }
  } catch (error: any) {
    console.log('❌ Page data failed:', error.message);
  }
}

testGetOrderId().catch(console.error);
