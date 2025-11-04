/**
 * Lunchlab web automation using Puppeteer
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { OrderSubmissionResult, MenuSummary } from './types';

const LUNCHLAB_BASE_URL = process.env.LUNCHLAB_BASE_URL || 'https://b2b.lunchlab.me';
const LUNCHLAB_USERNAME = process.env.LUNCHLAB_USERNAME || '';
const LUNCHLAB_PASSWORD = process.env.LUNCHLAB_PASSWORD || '';
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || './screenshots';
const COOKIES_PATH = './data/lunchlab-cookies.json';

/**
 * Initialize browser instance
 */
async function initBrowser(headless: boolean = true): Promise<Browser> {
  return await puppeteer.launch({
    headless: headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

/**
 * Save screenshot for debugging
 */
async function saveScreenshot(page: Page, filename: string): Promise<string> {
  try {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
    const screenshotPath = path.join(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: screenshotPath as `${string}.png`, fullPage: true });
    return screenshotPath;
  } catch (error) {
    console.error('Failed to save screenshot:', error);
    return '';
  }
}

/**
 * Load saved cookies if available
 */
async function loadCookies(page: Page): Promise<boolean> {
  try {
    const cookiesString = await fs.readFile(COOKIES_PATH, 'utf-8');
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);
    return true;
  } catch (error) {
    console.log('No saved cookies found, will need to login');
    return false;
  }
}

/**
 * Save cookies for future sessions
 */
async function saveCookies(page: Page): Promise<void> {
  try {
    const cookies = await page.cookies();
    await fs.mkdir('data', { recursive: true });
    await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  } catch (error) {
    console.error('Failed to save cookies:', error);
  }
}

/**
 * Login to Lunchlab
 */
async function login(page: Page): Promise<boolean> {
  try {
    console.log('Attempting to login to Lunchlab...');

    // Navigate to login page
    await page.goto(`${LUNCHLAB_BASE_URL}/auth/sign-in`, {
      waitUntil: 'networkidle2',
    });

    console.log('Current URL after navigation:', page.url());

    // Wait for login form
    await page.waitForSelector('input[name="username"]', {
      timeout: 10000,
    });

    // Fill in credentials (for React controlled inputs)
    console.log('Filling in credentials...');

    // For React apps, we need to trigger input events properly
    // @ts-ignore - this code runs in browser context
    await page.evaluate((username: string, password: string) => {
      // @ts-ignore
      const usernameInput = document.querySelector('input[name="username"]');
      // @ts-ignore
      const passwordInput = document.querySelector('input[name="password"]');

      if (usernameInput) {
        // @ts-ignore
        usernameInput.value = username;
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
        usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (passwordInput) {
        // @ts-ignore
        passwordInput.value = password;
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
        passwordInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, LUNCHLAB_USERNAME, LUNCHLAB_PASSWORD);

    // Wait a bit for React to process
    await new Promise(resolve => setTimeout(resolve, 500));

    // Click login button and wait for navigation
    console.log('Clicking login button...');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(err => {
        console.log('Navigation warning:', err.message);
      }),
      page.click('button[type="submit"]'),
    ]);

    // Wait a bit more for any redirects
    await new Promise(resolve => setTimeout(resolve, 2000));

    const finalUrl = page.url();
    console.log('Final URL after login:', finalUrl);

    // Check if login was successful by checking URL
    if (finalUrl.includes('/auth/sign-in')) {
      console.error('Still on login page - login may have failed');
      await saveScreenshot(page, `login-failed-${Date.now()}.png`);

      // Check for error messages (screenshot saved above)
      const html = await page.content();
      console.log('Page HTML length:', html.length, 'characters');

      return false;
    }

    // Save cookies for future use
    await saveCookies(page);

    console.log('Login successful');
    return true;
  } catch (error) {
    console.error('Login failed:', error);
    await saveScreenshot(page, `login-error-${Date.now()}.png`);
    return false;
  }
}

/**
 * Check if already logged in
 */
async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // Try to access a protected page
    const response = await page.goto(`${LUNCHLAB_BASE_URL}/console/order`, {
      waitUntil: 'networkidle2',
    });

    // If we're redirected to login page, we're not logged in
    const currentUrl = page.url();
    return !currentUrl.includes('/auth/signin');
  } catch (error) {
    console.error('Failed to check login status:', error);
    return false;
  }
}

/**
 * Ensure user is logged in (load cookies or login if needed)
 */
async function ensureLoggedIn(page: Page, forceLogin: boolean = false): Promise<boolean> {
  if (!forceLogin) {
    // Try loading saved cookies
    const cookiesLoaded = await loadCookies(page);

    // Check if cookies worked
    if (cookiesLoaded && await isLoggedIn(page)) {
      console.log('Already logged in via saved cookies');
      return true;
    }
  }

  // Need to login
  console.log('Logging in with credentials...');
  return await login(page);
}

/**
 * Submit order to Lunchlab
 */
export async function submitOrder(
  orderDate: string,
  menuSummary: MenuSummary
): Promise<OrderSubmissionResult> {
  let browser: Browser | null = null;

  try {
    console.log(`Submitting order for ${orderDate}:`, menuSummary);

    browser = await initBrowser();
    const page = await browser.newPage();

    // Login
    if (!(await ensureLoggedIn(page))) {
      return {
        success: false,
        error: 'Failed to login',
        screenshotPath: await saveScreenshot(page, `login-failed-${Date.now()}.png`),
      };
    }

    // Navigate to order page for specific date
    await page.goto(`${LUNCHLAB_BASE_URL}/console/order?date=${orderDate}`, {
      waitUntil: 'networkidle2',
    });

    // Wait for form to load
    await page.waitForSelector('form, input, select', { timeout: 10000 });

    // Take screenshot for inspection
    const inspectScreenshot = await saveScreenshot(page, `order-form-${orderDate}.png`);
    console.log(`Order form screenshot saved: ${inspectScreenshot}`);

    // TODO: Implement actual form filling logic after inspecting the form structure
    // This will be completed after we test and see the actual form structure

    // For now, just log what we would do
    console.log('Form inspection needed - check screenshot to implement form filling');
    console.log('Expected to fill:', menuSummary);

    // Placeholder: Return success for now (will implement actual submission)
    return {
      success: false,
      error: 'Form filling not yet implemented - needs inspection',
      screenshotPath: inspectScreenshot,
    };
  } catch (error) {
    console.error('Order submission failed:', error);
    const page = browser ? (await browser.pages())[0] : null;
    const screenshotPath = page
      ? await saveScreenshot(page, `error-${Date.now()}.png`)
      : undefined;

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      screenshotPath,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Update existing order
 */
export async function updateOrder(
  orderDate: string,
  menuSummary: MenuSummary,
  submissionId?: string
): Promise<OrderSubmissionResult> {
  // For Lunchlab, updating and submitting are likely the same process
  // Just navigate to the same page and re-submit
  return await submitOrder(orderDate, menuSummary);
}

/**
 * Inspect form structure (for development/debugging)
 */
export async function inspectForm(
  orderDate: string,
  forceLogin: boolean = false,
  headless: boolean = true
): Promise<void> {
  let browser: Browser | null = null;

  try {
    console.log(`Inspecting order form for ${orderDate}...`);

    browser = await initBrowser(headless);
    const page = await browser.newPage();

    // Login
    if (!(await ensureLoggedIn(page, forceLogin))) {
      console.error('Failed to login for inspection');
      return;
    }

    // Navigate to order page
    await page.goto(`${LUNCHLAB_BASE_URL}/console/order?date=${orderDate}`, {
      waitUntil: 'networkidle2',
    });

    // Wait a bit for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get page HTML structure
    const html = await page.content();
    const htmlPath = path.join(SCREENSHOTS_DIR, `form-structure-${orderDate}.html`);
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
    await fs.writeFile(htmlPath, html);

    // Take screenshot
    const screenshotPath = await saveScreenshot(page, `form-inspect-${orderDate}.png`);

    console.log('Form inspection complete:');
    console.log('  HTML:', htmlPath);
    console.log('  Screenshot:', screenshotPath);
  } catch (error) {
    console.error('Form inspection failed:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
