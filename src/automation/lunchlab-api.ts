/**
 * Lunchlab API Client
 * Direct API calls instead of browser automation
 */

import axios, { AxiosInstance } from 'axios';
import fs from 'fs/promises';
import { OrderSubmissionResult, MenuSummary } from './types';

const API_BASE_URL = 'https://api.lunchlab.me/b2b/core-service';
const B2B_BASE_URL = process.env.LUNCHLAB_BASE_URL || 'https://b2b.lunchlab.me';
const COOKIES_PATH = './data/lunchlab-cookies.json';

interface LunchlabCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

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
 * Load cookies from file
 */
async function loadCookies(): Promise<string> {
  try {
    const cookiesString = await fs.readFile(COOKIES_PATH, 'utf-8');
    const cookies: LunchlabCookie[] = JSON.parse(cookiesString);

    // Convert cookies to Cookie header format
    return cookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
  } catch (error) {
    throw new Error('Failed to load cookies. Please run extract-cookies.ts first.');
  }
}

/**
 * Get JWT token from B2B site
 */
async function getAuthToken(): Promise<string> {
  const cookieHeader = await loadCookies();

  const response = await axios.get(`${B2B_BASE_URL}/api/auth/token`, {
    headers: {
      'Cookie': cookieHeader,
      'Accept': '*/*',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  if (typeof response.data !== 'string') {
    throw new Error('Invalid token response');
  }

  return response.data; // JWT token
}

/**
 * Get order page data to extract product IDs and address ID
 */
async function getOrderPageData(orderDate: string): Promise<{
  productIds: { [key: string]: string };
  addressId: string;
  deliveryScheduleId: number;
}> {
  const cookieHeader = await loadCookies();

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

  // Map internal product IDs to actual API product IDs
  // Stock order: 가정식 (productId: 4), 프레시밀 (productId: 23)
  if (stocks.length >= 1) {
    const internalId = stocks[0].productId;
    productIds['가정식'] = PRODUCT_ID_MAP[internalId] || '';
  }
  if (stocks.length >= 2) {
    const internalId = stocks[1].productId;
    productIds['프레시밀'] = PRODUCT_ID_MAP[internalId] || '';
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

    // Get auth token
    const token = await getAuthToken();
    console.log('✅ Got auth token');

    // Get product IDs and address ID
    const { productIds, addressId } = await getOrderPageData(orderDate);
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
    const orderRequest: OrderRequest = {
      deliveryDate: orderDate,
      addressId: addressId,
      items: items,
    };

    console.log('📤 Submitting order:', JSON.stringify(orderRequest, null, 2));

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
  submissionId?: string
): Promise<OrderSubmissionResult> {
  try {
    console.log(`Updating order for ${orderDate} via API:`, menuSummary);

    // Get auth token
    const token = await getAuthToken();
    console.log('✅ Got auth token');

    // Get product IDs and address ID
    const { productIds, addressId } = await getOrderPageData(orderDate);
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

    const orderRequest: OrderRequest = {
      deliveryDate: orderDate,
      addressId: addressId,
      items: items,
    };

    console.log('📤 Updating order:', JSON.stringify(orderRequest, null, 2));

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

    // If update fails, try creating a new order instead
    // (Lunchlab might handle updates as new submissions)
    console.log('Retrying as new order submission...');
    return await submitOrder(orderDate, menuSummary);
  }
}
