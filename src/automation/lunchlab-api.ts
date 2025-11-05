/**
 * Lunchlab API Client
 * Direct API calls instead of browser automation
 */

import axios from 'axios';
import { OrderSubmissionResult, MenuSummary } from './types';
import { getMealDateFromOrderDate } from '../utils/time';

const API_BASE_URL = 'https://api.lunchlab.me/b2b/core-service';
const B2B_BASE_URL = process.env.LUNCHLAB_BASE_URL || 'https://b2b.lunchlab.me';

interface OrderItem {
  productId: string;
  quantity: number;
}

interface OrderRequest {
  deliveryDate: string;
  addressId: string;
  items: OrderItem[];
}

/**
 * Product ID mapping
 * Maps internal product IDs (4, 23) to actual API product IDs
 * These are consistent across all dates
 */
const PRODUCT_ID_MAP: { [key: number]: string } = {
  4: 'recEP1DuEfJi8VZUS',      // 가정식
  23: '60b98b1c-bcd2-4d12-95b2-435f65b3fee3',  // 프레시밀
};

/**
 * Login and get session cookies
 */
async function login(): Promise<string> {
  const username = process.env.LUNCHLAB_USERNAME;
  const password = process.env.LUNCHLAB_PASSWORD;

  if (!username || !password) {
    throw new Error('LUNCHLAB_USERNAME and LUNCHLAB_PASSWORD must be set in environment variables');
  }

  // Step 1: Get CSRF token
  const csrfResponse = await axios.get(`${B2B_BASE_URL}/api/auth/csrf`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  const csrfToken = csrfResponse.data.csrfToken;
  const csrfCookies = csrfResponse.headers['set-cookie'] || [];

  console.log('✅ Got CSRF token');

  // Step 2: Login with credentials
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

  if (sessionCookies.length === 0) {
    throw new Error('Login failed: No session cookies received');
  }

  console.log('✅ Login successful');

  // Combine all cookies
  const allCookies = [...csrfCookies, ...sessionCookies]
    .map(c => c.split(';')[0])
    .join('; ');

  return allCookies;
}

/**
 * Get order page data to extract product IDs and address ID
 */
async function getOrderPageData(orderDate: string, cookieHeader: string): Promise<{
  productIds: { [key: string]: string };
  addressId: string;
  deliveryScheduleId: number;
}> {

  // Get the Next.js build ID first
  const htmlResponse = await axios.get(`${B2B_BASE_URL}/console/order?date=${orderDate}`, {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  // Extract build ID from HTML
  const buildIdMatch = htmlResponse.data.match(/"buildId":"([^"]+)"/);
  if (!buildIdMatch) {
    throw new Error('Could not find build ID');
  }

  const buildId = buildIdMatch[1];

  // Fetch order page data
  const dataUrl = `${B2B_BASE_URL}/_next/data/${buildId}/console/order.json?date=${orderDate}`;
  const dataResponse = await axios.get(dataUrl, {
    headers: {
      'Cookie': cookieHeader,
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  const pageData = dataResponse.data.pageProps;

  // Extract product IDs from delivery schedule and map to actual API IDs
  const stocks = pageData.deliverySchedule?.stocks || [];
  const productIds: { [key: string]: string } = {};

  if (stocks.length > 0) {
    // Use stocks data if available
    // Stock order: 가정식 (productId: 4), 프레시밀 (productId: 23)
    if (stocks.length >= 1) {
      const internalId = stocks[0].productId;
      productIds['가정식'] = PRODUCT_ID_MAP[internalId] || '';
    }
    if (stocks.length >= 2) {
      const internalId = stocks[1].productId;
      productIds['프레시밀'] = PRODUCT_ID_MAP[internalId] || '';
    }
  } else {
    // Fallback: Use direct mapping when deliverySchedule is null
    // This happens when modifying orders or on non-orderable dates
    console.log('⚠️  No stocks data, using direct product ID mapping');
    productIds['가정식'] = PRODUCT_ID_MAP[4];
    productIds['프레시밀'] = PRODUCT_ID_MAP[23];
  }

  // Get address ID from addresses
  const addressId = pageData.addresses?.[0]?.recordId || '';

  return {
    productIds,
    addressId,
    deliveryScheduleId: pageData.deliverySchedule?.id,
  };
}

/**
 * Submit order via API
 */
export async function submitOrder(
  orderDate: string,
  menuSummary: MenuSummary
): Promise<OrderSubmissionResult> {
  try {
    console.log(`Submitting order for ${orderDate} via API:`, menuSummary);

    // Login and get session cookies
    const cookieHeader = await login();

    // Get JWT token
    const tokenResponse = await axios.get(`${B2B_BASE_URL}/api/auth/token`, {
      headers: {
        'Cookie': cookieHeader,
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (typeof tokenResponse.data !== 'string') {
      throw new Error('Invalid token response');
    }

    const token = tokenResponse.data;
    console.log('✅ Got auth token');

    // Get product IDs and address ID
    const { productIds, addressId } = await getOrderPageData(orderDate, cookieHeader);
    console.log('✅ Got order page data:', { productIds, addressId });

    // Build order items
    const items: OrderItem[] = [];

    if (menuSummary.가정식 > 0 && productIds.가정식) {
      items.push({
        productId: productIds.가정식,
        quantity: menuSummary.가정식,
      });
    }

    if (menuSummary.프레시밀 > 0 && productIds.프레시밀) {
      items.push({
        productId: productIds.프레시밀,
        quantity: menuSummary.프레시밀,
      });
    }

    if (items.length === 0) {
      return {
        success: false,
        error: 'No items to order',
      };
    }

    // Submit order
    // Convert order date (주문일) to meal date (식사일/배송일)
    const mealDate = getMealDateFromOrderDate(orderDate);

    const orderRequest: OrderRequest = {
      deliveryDate: mealDate,
      addressId: addressId,
      items: items,
    };

    console.log(`📤 Submitting order for ${orderDate} (meal date: ${mealDate}):`, JSON.stringify(orderRequest, null, 2));

    const response = await axios.post(
      `${API_BASE_URL}/order`,
      orderRequest,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Origin': B2B_BASE_URL,
          'Referer': `${B2B_BASE_URL}/`,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      }
    );

    console.log('✅ Order submitted successfully');
    console.log('Response:', response.data);

    return {
      success: true,
      submissionId: response.data?.id || response.data?.orderId || orderDate,
    };
  } catch (error: any) {
    console.error('❌ Order submission failed:', error.message);

    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);

      // If order already exists (400 error), automatically try updating instead
      if (error.response.status === 400 &&
          error.response.data?.message?.includes('이미 등록된 주문')) {
        console.log('🔄 Order already exists, automatically switching to update...');
        return await updateOrder(orderDate, menuSummary);
      }
    }

    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Unknown error',
    };
  }
}

/**
 * Update existing order via API
 */
export async function updateOrder(
  orderDate: string,
  menuSummary: MenuSummary,
  submissionId?: string,
  isRetry: boolean = false
): Promise<OrderSubmissionResult> {
  try {
    console.log(`Updating order for ${orderDate} via API:`, menuSummary);

    // Login and get session cookies
    const cookieHeader = await login();

    // Get JWT token
    const tokenResponse = await axios.get(`${B2B_BASE_URL}/api/auth/token`, {
      headers: {
        'Cookie': cookieHeader,
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (typeof tokenResponse.data !== 'string') {
      throw new Error('Invalid token response');
    }

    const token = tokenResponse.data;
    console.log('✅ Got auth token');

    // Get product IDs and address ID
    const { productIds, addressId } = await getOrderPageData(orderDate, cookieHeader);
    console.log('✅ Got order page data');

    // Build order items
    const items: OrderItem[] = [];

    if (menuSummary.가정식 > 0 && productIds.가정식) {
      items.push({
        productId: productIds.가정식,
        quantity: menuSummary.가정식,
      });
    }

    if (menuSummary.프레시밀 > 0 && productIds.프레시밀) {
      items.push({
        productId: productIds.프레시밀,
        quantity: menuSummary.프레시밀,
      });
    }

    // Convert order date (주문일) to meal date (식사일/배송일)
    const mealDate = getMealDateFromOrderDate(orderDate);

    const orderRequest: OrderRequest = {
      deliveryDate: mealDate,
      addressId: addressId,
      items: items,
    };

    console.log(`📤 Updating order for ${orderDate} (meal date: ${mealDate}):`, JSON.stringify(orderRequest, null, 2));

    // Try PUT or PATCH request (may need to adjust endpoint)
    const response = await axios.put(
      `${API_BASE_URL}/order${submissionId ? `/${submissionId}` : ''}`,
      orderRequest,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Origin': B2B_BASE_URL,
          'Referer': `${B2B_BASE_URL}/`,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      }
    );

    console.log('✅ Order updated successfully');
    console.log('Response:', response.data);

    return {
      success: true,
      submissionId: response.data?.id || response.data?.orderId || submissionId || orderDate,
    };
  } catch (error: any) {
    console.error('❌ Order update failed:', error.message);

    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }

    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Unknown error',
    };
  }
}
