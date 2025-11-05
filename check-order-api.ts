/**
 * Check order API endpoint
 */

import dotenv from 'dotenv';
dotenv.config();

import axios from 'axios';

const B2B_BASE_URL = process.env.LUNCHLAB_BASE_URL || 'https://b2b.lunchlab.me';
const API_BASE_URL = 'https://api.lunchlab.me/b2b/core-service';

async function login(): Promise<string> {
  const username = process.env.LUNCHLAB_USERNAME;
  const password = process.env.LUNCHLAB_PASSWORD;

  if (!username || !password) {
    throw new Error('LUNCHLAB_USERNAME and LUNCHLAB_PASSWORD must be set');
  }

  // Get CSRF token
  const csrfResponse = await axios.get(`${B2B_BASE_URL}/api/auth/csrf`, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
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
      },
      maxRedirects: 0,
      validateStatus: (status) => status === 302 || status === 200,
    }
  );

  const sessionCookies = loginResponse.headers['set-cookie'] || [];
  return [...csrfCookies, ...sessionCookies].map(c => c.split(';')[0]).join('; ');
}

async function checkOrderAPI() {
  const cookieHeader = await login();
  console.log('✅ Logged in\n');

  // Get JWT token
  const tokenResponse = await axios.get(`${B2B_BASE_URL}/api/auth/token`, {
    headers: {
      'Cookie': cookieHeader,
    },
  });

  const token = tokenResponse.data;
  console.log('✅ Got JWT token\n');

  // Try to get existing orders
  console.log('Checking for existing orders...\n');

  try {
    const ordersResponse = await axios.get(`${API_BASE_URL}/order`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    console.log('📦 Existing orders:');
    console.log(JSON.stringify(ordersResponse.data, null, 2));
  } catch (error: any) {
    console.error('Error getting orders:', error.response?.data || error.message);
  }

  // Try specific date
  console.log('\n\nChecking order for specific date (2025-11-06)...\n');
  try {
    const dateOrderResponse = await axios.get(`${API_BASE_URL}/order?deliveryDate=2025-11-06`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    console.log('📦 Order for 2025-11-06:');
    console.log(JSON.stringify(dateOrderResponse.data, null, 2));
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

checkOrderAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
