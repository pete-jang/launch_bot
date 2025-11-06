/**
 * Order submission orchestration layer
 * Handles automatic submission to Lunchlab when orders reach minimum quantity
 */

// Use API client instead of Puppeteer automation
import { submitOrder, updateOrder, cancelOrder } from "./lunchlab-api";
import {
  getMenuSummary,
  getOrderCountForDate,
  isOrderSubmitted,
  markOrderAsSubmitted,
  getSubmissionId,
  markOrderAsNotSubmitted,
} from "../storage/orders";
import { getCurrentMealDate } from "../utils/time";
import { app } from "../bot";

const MINIMUM_ORDER_COUNT = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if orders meet minimum quantity and submit if ready
 */
export async function submitOrdersIfReady(
  mealDate: string = getCurrentMealDate(),
  channelId?: string,
): Promise<void> {
  try {
    console.log(`Checking if orders are ready to submit for ${mealDate}...`);

    // Check if already submitted
    const alreadySubmitted = await isOrderSubmitted(mealDate);
    if (alreadySubmitted) {
      console.log(
        `Orders for ${mealDate} already submitted. Use updateSubmittedOrder() to modify.`,
      );
      return;
    }

    // Get order count
    const orderCount = await getOrderCountForDate(mealDate);
    console.log(`Current order count for ${mealDate}: ${orderCount}`);

    // Check minimum quantity
    if (orderCount < MINIMUM_ORDER_COUNT) {
      console.log(
        `Order count (${orderCount}) below minimum (${MINIMUM_ORDER_COUNT}). Not submitting yet.`,
      );

      // Notify channel if provided
      if (channelId) {
        await notifyMinimumNotMet(channelId, orderCount);
      }
      return;
    }

    // Get menu summary for submission
    const menuSummary = await getMenuSummary(mealDate);
    console.log(`Menu summary for ${mealDate}:`, menuSummary);

    // Submit with retry logic
    const result = await submitWithRetry(mealDate, menuSummary);

    if (result.success) {
      // Mark as submitted in database
      await markOrderAsSubmitted(mealDate, result.submissionId);
      console.log(`Successfully submitted orders for ${mealDate}`);

      // Notify success
      if (channelId) {
        await notifySubmissionSuccess(channelId, mealDate, menuSummary);
      }
    } else {
      console.error(`Failed to submit orders for ${mealDate}:`, result.error);

      // Notify failure
      if (channelId) {
        await notifySubmissionFailure(
          channelId,
          mealDate,
          result.error,
          result.screenshotPath,
        );
      }
    }
  } catch (error) {
    console.error("Error in submitOrdersIfReady:", error);
  }
}

/**
 * Update already submitted order
 */
export async function updateSubmittedOrder(
  mealDate: string = getCurrentMealDate(),
  channelId?: string,
): Promise<void> {
  try {
    console.log(`Updating submitted order for ${mealDate}...`);

    // Check if already submitted
    const alreadySubmitted = await isOrderSubmitted(mealDate);
    if (!alreadySubmitted) {
      console.log(
        `Orders for ${mealDate} not yet submitted. Use submitOrdersIfReady() first.`,
      );
      return;
    }

    // Get current order count
    const orderCount = await getOrderCountForDate(mealDate);

    // Check minimum quantity
    if (orderCount < MINIMUM_ORDER_COUNT) {
      console.log(
        `Order count (${orderCount}) below minimum (${MINIMUM_ORDER_COUNT}). Cannot update.`,
      );
      return;
    }

    // Get menu summary
    const menuSummary = await getMenuSummary(mealDate);
    const submissionId = await getSubmissionId(mealDate);

    console.log(`Updating order for ${mealDate}:`, menuSummary);

    // Update with retry logic
    const result = await updateWithRetry(
      mealDate,
      menuSummary,
      submissionId || undefined,
    );

    if (result.success) {
      // Update submission ID if changed
      if (result.submissionId && result.submissionId !== submissionId) {
        await markOrderAsSubmitted(mealDate, result.submissionId);
      }
      console.log(`Successfully updated order for ${mealDate}`);

      // Notify success
      if (channelId) {
        await notifyUpdateSuccess(channelId, mealDate, menuSummary);
      }
    } else {
      console.error(`Failed to update order for ${mealDate}:`, result.error);

      // Notify failure
      if (channelId) {
        await notifySubmissionFailure(
          channelId,
          mealDate,
          result.error,
          result.screenshotPath,
        );
      }
    }
  } catch (error) {
    console.error("Error in updateSubmittedOrder:", error);
  }
}

/**
 * Submit order with retry logic
 */
async function submitWithRetry(
  mealDate: string,
  menuSummary: { 가정식: number; 프레시밀: number },
  retryCount: number = 0,
): Promise<any> {
  const result = await submitOrder(mealDate, menuSummary);

  if (!result.success && retryCount < MAX_RETRIES) {
    console.log(
      `Submission failed (attempt ${retryCount + 1}/${MAX_RETRIES}). Retrying in ${RETRY_DELAY_MS / 1000}s...`,
    );

    // Wait before retry
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

    // Retry
    return submitWithRetry(mealDate, menuSummary, retryCount + 1);
  }

  return result;
}

/**
 * Update order with retry logic
 */
async function updateWithRetry(
  mealDate: string,
  menuSummary: { 가정식: number; 프레시밀: number },
  submissionId?: string,
  retryCount: number = 0,
): Promise<any> {
  const result = await updateOrder(mealDate, menuSummary, submissionId);

  if (!result.success && retryCount < MAX_RETRIES) {
    console.log(
      `Update failed (attempt ${retryCount + 1}/${MAX_RETRIES}). Retrying in ${RETRY_DELAY_MS / 1000}s...`,
    );

    // Wait before retry
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

    // Retry
    return updateWithRetry(mealDate, menuSummary, submissionId, retryCount + 1);
  }

  return result;
}

/**
 * Notify that minimum order count not met
 */
async function notifyMinimumNotMet(
  channelId: string,
  currentCount: number,
): Promise<void> {
  try {
    await app.client.chat.postMessage({
      channel: channelId,
      text: `⚠️ 최소 주문 수량(${MINIMUM_ORDER_COUNT}개)에 미달하여 실제 주문이 제출되지 않았습니다.\n현재 주문: ${currentCount}개`,
    });
  } catch (error) {
    console.error("Failed to notify minimum not met:", error);
  }
}

/**
 * Notify submission success
 */
async function notifySubmissionSuccess(
  channelId: string,
  mealDate: string,
  menuSummary: { 가정식: number; 프레시밀: number },
): Promise<void> {
  try {
    await app.client.chat.postMessage({
      channel: channelId,
      text: `✅ Lunchlab 주문이 자동으로 제출되었습니다!\n식사일: ${mealDate}\n🍚 가정식: ${menuSummary.가정식}개\n🥗 프레시밀: ${menuSummary.프레시밀}개`,
    });
  } catch (error) {
    console.error("Failed to notify submission success:", error);
  }
}

/**
 * Notify update success
 */
async function notifyUpdateSuccess(
  channelId: string,
  mealDate: string,
  menuSummary: { 가정식: number; 프레시밀: number },
): Promise<void> {
  try {
    await app.client.chat.postMessage({
      channel: channelId,
      text: `🔄 Lunchlab 주문이 수정되었습니다.\n식사일: ${mealDate}\n🍚 가정식: ${menuSummary.가정식}개\n🥗 프레시밀: ${menuSummary.프레시밀}개`,
    });
  } catch (error) {
    console.error("Failed to notify update success:", error);
  }
}

/**
 * Notify submission failure (with admin mention)
 */
async function notifySubmissionFailure(
  channelId: string,
  mealDate: string,
  error?: string,
  screenshotPath?: string,
): Promise<void> {
  try {
    const adminIds = process.env.SLACK_ADMIN_IDS?.split(",") || [];
    const adminMentions = adminIds.map((id) => `<@${id.trim()}>`).join(" ");

    let text = `❌ Lunchlab 주문 제출에 실패했습니다. ${adminMentions}\n식사일: ${mealDate}`;

    if (error) {
      text += `\n에러: ${error}`;
    }

    if (screenshotPath) {
      text += `\n스크린샷: ${screenshotPath}`;
    }

    await app.client.chat.postMessage({
      channel: channelId,
      text,
    });
  } catch (error) {
    console.error("Failed to notify submission failure:", error);
  }
}

/**
 * Cancel Lunchlab order when count falls below minimum
 */
export async function cancelSubmittedOrder(
  mealDate: string = getCurrentMealDate(),
  channelId?: string,
): Promise<void> {
  try {
    console.log(`Cancelling submitted order for ${mealDate}...`);

    const alreadySubmitted = await isOrderSubmitted(mealDate);
    if (!alreadySubmitted) {
      console.log(
        `Orders for ${mealDate} not yet submitted. Nothing to cancel.`,
      );
      return;
    }

    const submissionId = await getSubmissionId(mealDate);

    // Cancel on Lunchlab
    const result = await cancelWithRetry(mealDate, submissionId || undefined);

    if (result.success) {
      // Mark as not submitted in database
      await markOrderAsNotSubmitted(mealDate);
      console.log(`Successfully cancelled order for ${mealDate}`);

      // Notify success
      if (channelId) {
        await notifyCancellationSuccess(channelId, mealDate);
      }
    } else {
      console.error(`Failed to cancel order for ${mealDate}:`, result.error);

      // Notify failure
      if (channelId) {
        await notifyCancellationFailure(channelId, mealDate, result.error);
      }
    }
  } catch (error) {
    console.error("Error in cancelSubmittedOrder:", error);
  }
}

/**
 * Cancel order with retry logic
 */
async function cancelWithRetry(
  mealDate: string,
  submissionId?: string,
  retryCount: number = 0,
): Promise<any> {
  const result = await cancelOrder(mealDate, submissionId);

  if (!result.success && retryCount < MAX_RETRIES) {
    console.log(
      `Cancellation failed (attempt ${retryCount + 1}/${MAX_RETRIES}). Retrying in ${RETRY_DELAY_MS / 1000}s...`,
    );

    // Wait before retry
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));

    // Retry
    return cancelWithRetry(mealDate, submissionId, retryCount + 1);
  }

  return result;
}

/**
 * Notify cancellation success
 */
async function notifyCancellationSuccess(
  channelId: string,
  mealDate: string,
): Promise<void> {
  try {
    await app.client.chat.postMessage({
      channel: channelId,
      text: `✅ Lunchlab 주문이 취소되었습니다.\n식사일: ${mealDate}`,
    });
  } catch (error) {
    console.error("Failed to notify cancellation success:", error);
  }
}

/**
 * Notify cancellation failure
 */
async function notifyCancellationFailure(
  channelId: string,
  mealDate: string,
  error?: string,
): Promise<void> {
  try {
    const adminIds = process.env.SLACK_ADMIN_IDS?.split(",") || [];
    const adminMentions = adminIds.map((id) => `<@${id.trim()}>`).join(" ");

    let text = `❌ Lunchlab 주문 취소에 실패했습니다. ${adminMentions}\n식사일: ${mealDate}`;

    if (error) {
      text += `\n에러: ${error}`;
    }

    await app.client.chat.postMessage({
      channel: channelId,
      text,
    });
  } catch (error) {
    console.error("Failed to notify cancellation failure:", error);
  }
}
