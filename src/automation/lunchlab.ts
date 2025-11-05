/**
 * Lunchlab web automation using Puppeteer
 */

import puppeteer, { Browser, Page } from "puppeteer";
import fs from "fs/promises";
import path from "path";
import { OrderSubmissionResult, MenuSummary } from "./types";

const LUNCHLAB_BASE_URL =
  process.env.LUNCHLAB_BASE_URL || "https://b2b.lunchlab.me";
const LUNCHLAB_USERNAME = process.env.LUNCHLAB_USERNAME || "";
const LUNCHLAB_PASSWORD = process.env.LUNCHLAB_PASSWORD || "";
const SCREENSHOTS_DIR = process.env.SCREENSHOTS_DIR || "./screenshots";
const COOKIES_PATH = "./data/lunchlab-cookies.json";

/**
 * Initialize browser instance
 */
async function initBrowser(headless: boolean = true): Promise<Browser> {
  return await puppeteer.launch({
    headless: headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

/**
 * Save screenshot for debugging
 */
async function saveScreenshot(page: Page, filename: string): Promise<string> {
  try {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
    const screenshotPath = path.join(SCREENSHOTS_DIR, filename);
    await page.screenshot({
      path: screenshotPath as `${string}.png`,
      fullPage: true,
    });
    return screenshotPath;
  } catch (error) {
    console.error("Failed to save screenshot:", error);
    return "";
  }
}

/**
 * Load saved cookies if available
 */
async function loadCookies(page: Page): Promise<boolean> {
  try {
    const cookiesString = await fs.readFile(COOKIES_PATH, "utf-8");
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);
    return true;
  } catch (error) {
    console.log("No saved cookies found, will need to login");
    return false;
  }
}

/**
 * Save cookies for future sessions
 */
async function saveCookies(page: Page): Promise<void> {
  try {
    const cookies = await page.cookies();
    await fs.mkdir("data", { recursive: true });
    await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  } catch (error) {
    console.error("Failed to save cookies:", error);
  }
}

/**
 * Login to Lunchlab
 */
async function login(page: Page): Promise<boolean> {
  try {
    console.log("Attempting to login to Lunchlab...");

    // Enable request/response logging
    const loginRequests: any[] = [];
    page.on("request", (request) => {
      if (
        request.url().includes("/api/auth") ||
        request.url().includes("callback")
      ) {
        const postData = request.postData();
        loginRequests.push({
          url: request.url(),
          method: request.method(),
          postData: postData,
        });
        console.log(`  📤 Request: ${request.method()} ${request.url()}`);
        if (postData && request.method() === "POST") {
          console.log(`     POST data: ${postData.substring(0, 200)}`);
        }
      }
    });

    page.on("response", async (response) => {
      if (
        response.url().includes("/api/auth") ||
        response.url().includes("callback")
      ) {
        console.log(`  📥 Response: ${response.status()} ${response.url()}`);
        try {
          const text = await response.text();
          if (text && text.length < 500) {
            console.log(`     Body: ${text}`);
          }
        } catch (e) {
          // Ignore
        }
      }
    });

    // Navigate to login page
    await page.goto(`${LUNCHLAB_BASE_URL}/auth/sign-in`, {
      waitUntil: "networkidle2",
    });

    console.log("Current URL after navigation:", page.url());

    // Wait for login form
    await page.waitForSelector('input[name="username"]', {
      timeout: 10000,
    });

    // Fill in credentials (simple approach with proper focus)
    console.log("Filling in credentials...");

    // Focus and type into username field
    const usernameSelector = 'input[name="username"]';
    await page.click(usernameSelector);
    await page.focus(usernameSelector);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Type username slowly
    console.log("  Typing username...");
    await page.keyboard.type(LUNCHLAB_USERNAME, { delay: 100 });

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Focus and type into password field
    const passwordSelector = 'input[name="password"]';
    await page.click(passwordSelector);
    await page.focus(passwordSelector);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Type password slowly
    console.log("  Typing password...");
    await page.keyboard.type(LUNCHLAB_PASSWORD, { delay: 100 });

    // Wait for React to update
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Take a screenshot before clicking login
    await saveScreenshot(page, "before-login-click.png");
    console.log("  Screenshot saved before clicking login");

    // Click login button and wait for navigation
    console.log("Clicking login button...");

    // Take screenshot of button before clicking
    await saveScreenshot(page, "before-button-click.png");

    // Click the button
    await page.click('button[type="submit"]');
    console.log("  Button clicked, waiting for response...");

    // Wait for either navigation or error message
    try {
      await Promise.race([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 }),
        page
          .waitForSelector('.MuiAlert-message, .error, [role="alert"]', {
            timeout: 3000,
          })
          .then(async () => {
            const errorText = await page.evaluate(() => {
              // @ts-ignore
              const errorEl = document.querySelector(
                '.MuiAlert-message, .error, [role="alert"]',
              );
              // @ts-ignore
              return errorEl ? errorEl.innerText : null;
            });
            console.log("  ⚠️ Error message found:", errorText);
          }),
      ]);
    } catch (err) {
      console.log("  No navigation or error within timeout");
    }

    // Wait a bit more for any redirects
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const finalUrl = page.url();
    console.log("Final URL after login:", finalUrl);

    // Take screenshot after login attempt
    await saveScreenshot(page, "after-login-attempt.png");

    // Check if login was successful by checking URL
    if (finalUrl.includes("/auth/sign-in")) {
      console.log(
        "⚠️  Still on login page after first attempt - trying second login...",
      );

      // Second login attempt (some systems require this)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if form fields are still filled
      const formFilled = await page.evaluate(() => {
        // @ts-ignore
        const usernameInput = document.querySelector('input[name="username"]');
        // @ts-ignore
        const passwordInput = document.querySelector('input[name="password"]');
        // @ts-ignore
        return usernameInput?.value && passwordInput?.value;
      });

      if (!formFilled) {
        console.log("  Refilling credentials for second attempt...");

        // Refill credentials
        const usernameSelector = 'input[name="username"]';
        await page.click(usernameSelector);
        await page.focus(usernameSelector);
        await new Promise((resolve) => setTimeout(resolve, 200));
        await page.keyboard.type(LUNCHLAB_USERNAME, { delay: 100 });

        await new Promise((resolve) => setTimeout(resolve, 300));

        const passwordSelector = 'input[name="password"]';
        await page.click(passwordSelector);
        await page.focus(passwordSelector);
        await new Promise((resolve) => setTimeout(resolve, 200));
        await page.keyboard.type(LUNCHLAB_PASSWORD, { delay: 100 });

        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        console.log("  Form still filled, clicking login again...");
      }

      // Click login button again
      await page.click('button[type="submit"]');
      console.log("  Second login button clicked...");

      // Wait for navigation or error
      try {
        await page.waitForNavigation({
          waitUntil: "networkidle2",
          timeout: 10000,
        });
      } catch (err) {
        console.log("  No navigation after second attempt");
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const secondAttemptUrl = page.url();
      console.log("  URL after second attempt:", secondAttemptUrl);

      if (secondAttemptUrl.includes("/auth/sign-in")) {
        console.error("❌ Login failed after 2 attempts");
        await saveScreenshot(page, "login-failed-after-2-attempts.png");
        return false;
      } else {
        console.log("✅ Second login attempt successful!");
      }
    }

    // Save cookies for future use
    await saveCookies(page);

    console.log("Login successful");
    return true;
  } catch (error) {
    console.error("Login failed:", error);
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
      waitUntil: "networkidle2",
    });

    // If we're redirected to login page, we're not logged in
    const currentUrl = page.url();
    return !currentUrl.includes("/auth/signin");
  } catch (error) {
    console.error("Failed to check login status:", error);
    return false;
  }
}

/**
 * Ensure user is logged in (load cookies or login if needed)
 */
async function ensureLoggedIn(
  page: Page,
  forceLogin: boolean = false,
): Promise<boolean> {
  if (!forceLogin) {
    // Try loading saved cookies
    const cookiesLoaded = await loadCookies(page);

    // Check if cookies worked
    if (cookiesLoaded && (await isLoggedIn(page))) {
      console.log("Already logged in via saved cookies");
      return true;
    }
  }

  // Need to login
  console.log("Logging in with credentials...");
  return await login(page);
}

/**
 * Submit order to Lunchlab
 */
export async function submitOrder(
  orderDate: string,
  menuSummary: MenuSummary,
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
        error: "Failed to login",
        screenshotPath: await saveScreenshot(
          page,
          `login-failed-${Date.now()}.png`,
        ),
      };
    }

    // Navigate to order page for specific date
    await page.goto(`${LUNCHLAB_BASE_URL}/console/order?date=${orderDate}`, {
      waitUntil: "networkidle2",
    });

    // Wait for form to load
    await page.waitForSelector("form", { timeout: 10000 });
    console.log("Order form loaded");

    // Wait for menu items to load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Take screenshot before filling
    await saveScreenshot(page, `before-filling-${orderDate}.png`);

    // Find all add buttons (+ icons)
    const addButtons = await page.$$('button svg[data-testid="AddIcon"]');
    console.log(`Found ${addButtons.length} add buttons`);

    // Menu mapping: index 0 = 가정식, index 1 = 프레시밀
    const menuMap = ["가정식", "프레시밀"];

    for (let i = 0; i < addButtons.length && i < menuMap.length; i++) {
      const menuType = menuMap[i] as "가정식" | "프레시밀";
      const quantity = menuSummary[menuType];

      if (quantity > 0) {
        console.log(`Clicking + button for ${menuType} ${quantity} times...`);

        // Get the button element (parent of the SVG)
        const buttonElement = await page.evaluateHandle((svg) => {
          // @ts-ignore
          return svg.closest("button");
        }, addButtons[i]);

        // Click the + button multiple times
        for (let j = 0; j < quantity; j++) {
          await (buttonElement as any).click();
          console.log(`  Clicked ${j + 1}/${quantity}`);
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }

    // Wait for React to update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Take screenshot after filling
    await saveScreenshot(page, `after-filling-${orderDate}.png`);

    // Check if submit button is enabled
    const submitButtonEnabled = await page.evaluate(() => {
      // @ts-ignore
      const submitButton = document.querySelector('button[type="submit"]');
      // @ts-ignore
      return submitButton && !submitButton.disabled;
    });

    console.log(`Submit button enabled: ${submitButtonEnabled}`);

    if (!submitButtonEnabled) {
      return {
        success: false,
        error: "Submit button not enabled - check minimum quantity",
        screenshotPath: await saveScreenshot(
          page,
          `submit-disabled-${orderDate}.png`,
        ),
      };
    }

    // Click submit button
    console.log("Clicking submit button...");
    await page.click('button[type="submit"]');

    // Wait for response
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Take screenshot after submission
    const afterSubmitScreenshot = await saveScreenshot(
      page,
      `after-submit-${orderDate}.png`,
    );

    // Check if submission was successful
    const currentUrl = page.url();
    console.log(`Current URL after submission: ${currentUrl}`);

    // TODO: Add logic to check for success message or confirmation
    // For now, assume success if still on console page
    if (currentUrl.includes("/console")) {
      return {
        success: true,
        submissionId: orderDate, // Use order date as ID for now
        screenshotPath: afterSubmitScreenshot,
      };
    } else {
      return {
        success: false,
        error: "Unexpected URL after submission",
        screenshotPath: afterSubmitScreenshot,
      };
    }
  } catch (error) {
    console.error("Order submission failed:", error);
    const page = browser ? (await browser.pages())[0] : null;
    const screenshotPath = page
      ? await saveScreenshot(page, `error-${Date.now()}.png`)
      : undefined;

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
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
  submissionId?: string,
): Promise<OrderSubmissionResult> {
  let browser: Browser | null = null;

  try {
    console.log(`Updating order for ${orderDate}:`, menuSummary);

    browser = await initBrowser(); // headless = true (production)
    const page = await browser.newPage();

    // Login (force fresh login for update to ensure valid session)
    if (!(await ensureLoggedIn(page, true))) {
      return {
        success: false,
        error: "Failed to login",
        screenshotPath: await saveScreenshot(
          page,
          `login-failed-${Date.now()}.png`,
        ),
      };
    }

    // Navigate to order page for specific date
    console.log(
      `Navigating to ${LUNCHLAB_BASE_URL}/console/order?date=${orderDate}`,
    );
    await page.goto(`${LUNCHLAB_BASE_URL}/console/order?date=${orderDate}`, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    console.log(`Current URL: ${page.url()}`);

    // Wait extra time for React to render
    console.log("Waiting for page to fully render...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Take screenshot to see what's on the page
    await saveScreenshot(page, `page-loaded-${orderDate}.png`);

    // Check if form exists
    const formExists = await page.evaluate(() => {
      // @ts-ignore
      const form = document.querySelector("form");
      // @ts-ignore
      const body = document.body.innerHTML;
      return {
        formExists: !!form,
        bodyLength: body.length,
        // @ts-ignore
        title: document.title,
      };
    });

    console.log("Page check:", formExists);

    // If form doesn't exist, might be on order detail page - click "주문 수정" button
    if (!formExists.formExists) {
      console.log('Form not found - checking for "주문 수정" button...');

      // Look for "주문 수정" button
      const modifyButton = await page
        .$('button:has-text("주문 수정")')
        .catch(() => null);

      if (!modifyButton) {
        // Try finding button by text content
        const buttonFound = await page.evaluate(() => {
          // @ts-ignore
          const buttons = Array.from(document.querySelectorAll("button"));
          // @ts-ignore
          const modifyBtn = buttons.find((btn) =>
            btn.textContent.includes("주문 수정"),
          );
          if (modifyBtn) {
            // @ts-ignore
            modifyBtn.click();
            return true;
          }
          return false;
        });

        if (buttonFound) {
          console.log('Clicked "주문 수정" button');
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } else {
          console.log('Could not find "주문 수정" button');
        }
      } else {
        await modifyButton.click();
        console.log('Clicked "주문 수정" button');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Wait for form to load
    await page.waitForSelector("form", { timeout: 10000 });
    console.log("Order form loaded");

    // Wait for menu items to load
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Take screenshot before update
    await saveScreenshot(page, `before-update-${orderDate}.png`);

    // Get current quantities from input fields
    const currentQuantities = await page.evaluate(() => {
      // @ts-ignore
      const inputs = Array.from(
        document.querySelectorAll('input[type="number"]'),
      );
      // @ts-ignore
      return inputs.map((input) => parseInt(input.value) || 0);
    });

    console.log("Current quantities:", currentQuantities);

    // Menu mapping: index 0 = 가정식, index 1 = 프레시밀
    const menuMap = ["가정식", "프레시밀"];
    const targetQuantities = [menuSummary.가정식, menuSummary.프레시밀];

    // Find add and remove buttons
    const addButtons = await page.$$('button svg[data-testid="AddIcon"]');
    const removeButtons = await page.$$('button svg[data-testid="RemoveIcon"]');

    console.log(
      `Found ${addButtons.length} add buttons, ${removeButtons.length} remove buttons`,
    );

    // Adjust quantities for each menu
    for (let i = 0; i < menuMap.length && i < currentQuantities.length; i++) {
      const menuType = menuMap[i];
      const currentQty = currentQuantities[i];
      const targetQty = targetQuantities[i];
      const diff = targetQty - currentQty;

      if (diff > 0) {
        // Need to add
        console.log(
          `${menuType}: Adding ${diff} (current: ${currentQty}, target: ${targetQty})`,
        );

        const buttonElement = await page.evaluateHandle((svg) => {
          // @ts-ignore
          return svg.closest("button");
        }, addButtons[i]);

        for (let j = 0; j < diff; j++) {
          await (buttonElement as any).click();
          console.log(`  Added ${j + 1}/${diff}`);
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      } else if (diff < 0) {
        // Need to remove
        const removeCount = Math.abs(diff);
        console.log(
          `${menuType}: Removing ${removeCount} (current: ${currentQty}, target: ${targetQty})`,
        );

        const buttonElement = await page.evaluateHandle((svg) => {
          // @ts-ignore
          return svg.closest("button");
        }, removeButtons[i]);

        for (let j = 0; j < removeCount; j++) {
          await (buttonElement as any).click();
          console.log(`  Removed ${j + 1}/${removeCount}`);
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      } else {
        console.log(`${menuType}: No change needed (already ${currentQty})`);
      }
    }

    // Wait for React to update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Take screenshot after adjusting quantities
    await saveScreenshot(page, `after-update-${orderDate}.png`);

    // Check if submit button is enabled
    const submitButtonEnabled = await page.evaluate(() => {
      // @ts-ignore
      const submitButton = document.querySelector('button[type="submit"]');
      // @ts-ignore
      return submitButton && !submitButton.disabled;
    });

    console.log(`Submit button enabled: ${submitButtonEnabled}`);

    if (!submitButtonEnabled) {
      return {
        success: false,
        error: "Submit button not enabled - check minimum quantity",
        screenshotPath: await saveScreenshot(
          page,
          `submit-disabled-update-${orderDate}.png`,
        ),
      };
    }

    // Click submit button
    console.log("Clicking submit button...");
    await page.click('button[type="submit"]');

    // Wait for response
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Take screenshot after submission
    const afterSubmitScreenshot = await saveScreenshot(
      page,
      `after-submit-update-${orderDate}.png`,
    );

    // Check if submission was successful
    const currentUrl = page.url();
    console.log(`Current URL after update: ${currentUrl}`);

    if (currentUrl.includes("/console")) {
      return {
        success: true,
        submissionId: submissionId || orderDate,
        screenshotPath: afterSubmitScreenshot,
      };
    } else {
      return {
        success: false,
        error: "Unexpected URL after update",
        screenshotPath: afterSubmitScreenshot,
      };
    }
  } catch (error) {
    console.error("Order update failed:", error);
    const page = browser ? (await browser.pages())[0] : null;
    const screenshotPath = page
      ? await saveScreenshot(page, `error-update-${Date.now()}.png`)
      : undefined;

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      screenshotPath,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Inspect form structure (for development/debugging)
 */
export async function inspectForm(
  orderDate: string,
  forceLogin: boolean = false,
  headless: boolean = true,
): Promise<void> {
  let browser: Browser | null = null;

  try {
    console.log(`Inspecting order form for ${orderDate}...`);

    browser = await initBrowser(headless);
    const page = await browser.newPage();

    // Login
    if (!(await ensureLoggedIn(page, forceLogin))) {
      console.error("Failed to login for inspection");
      return;
    }

    // Navigate to order page
    await page.goto(`${LUNCHLAB_BASE_URL}/console/order?date=${orderDate}`, {
      waitUntil: "networkidle2",
    });

    // Wait a bit for dynamic content
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Get page HTML structure
    const html = await page.content();
    const htmlPath = path.join(
      SCREENSHOTS_DIR,
      `form-structure-${orderDate}.html`,
    );
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
    await fs.writeFile(htmlPath, html);

    // Take screenshot
    const screenshotPath = await saveScreenshot(
      page,
      `form-inspect-${orderDate}.png`,
    );

    console.log("Form inspection complete:");
    console.log("  HTML:", htmlPath);
    console.log("  Screenshot:", screenshotPath);
  } catch (error) {
    console.error("Form inspection failed:", error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
