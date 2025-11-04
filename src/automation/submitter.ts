/**
 * Order submission orchestration layer
 * Handles automatic submission to Lunchlab when orders reach minimum quantity
 */

import { submitOrder, updateOrder } from './lunchlab';
import {
  getMenuSummary,
  getOrderCountForDate,
  isOrderSubmitted,
  markOrderAsSubmitted,
  getSubmissionId,
} from '../storage/orders';
import { formatDate } from '../utils/time';
import { app } from '../bot';

const MINIMUM_ORDER_COUNT = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if orders meet minimum quantity and submit if ready
 */
export async function submitOrdersIfReady(
  orderDate: string = formatDate(),
  channelId?: string
): Promise<void> {
  try {
    console.log(`Checking if orders are ready to submit for ${orderDate}...`);

    // Check if already submitted
    const alreadySubmitted = await isOrderSubmitted(orderDate);
    if (alreadySubmitted) {
      console.log(`Orders for ${orderDate} already submitted. Use updateSubmittedOrder() to modify.`);
      return;
    }

    // Get order count
    const orderCount = await getOrderCountForDate(orderDate);
    console.log(`Current order count for ${orderDate}: ${orderCount}`);

    // Check minimum quantity
    if (orderCount < MINIMUM_ORDER_COUNT) {
      console.log(`Order count (${orderCount}) below minimum (${MINIMUM_ORDER_COUNT}). Not submitting yet.`);

      // Notify channel if provided
      if (channelId) {
        await notifyMinimumNotMet(channelId, orderCount);
      }
      return;
    }

    // Get menu summary for submission
    const menuSummary = await getMenuSummary(orderDate);
    console.log(`Menu summary for ${orderDate}:`, menuSummary);

    // Submit with retry logic
    const result = await submitWithRetry(orderDate, menuSummary);

    if (result.success) {
      // Mark as submitted in database
      await markOrderAsSubmitted(orderDate, result.submissionId);
      console.log(`Successfully submitted orders for ${orderDate}`);

      // Notify success
      if (channelId) {
        await notifySubmissionSuccess(channelId, orderDate, menuSummary);
      }
    } else {
      console.error(`Failed to submit orders for ${orderDate}:`, result.error);

      // Notify failure
      if (channelId) {
        await notifySubmissionFailure(channelId, orderDate, result.error, result.screenshotPath);
      }
    }
  } catch (error) {
    console.error('Error in submitOrdersIfReady:', error);
  }
}

/**
 * Update already submitted order
 */
export async function updateSubmittedOrder(
  orderDate: string = formatDate(),
  channelId?: string
): Promise<void> {
  try {
    console.log(`Updating submitted order for ${orderDate}...`);

    // Check if already submitted
    const alreadySubmitted = await isOrderSubmitted(orderDate);
    if (!alreadySubmitted) {
      console.log(`Orders for ${orderDate} not yet submitted. Use submitOrdersIfReady() first.`);
      return;
    }

    // Get current order count
    const orderCount = await getOrderCountForDate(orderDate);

    // Check minimum quantity
    if (orderCount < MINIMUM_ORDER_COUNT) {
      console.log(`Order count (${orderCount}) below minimum (${MINIMUM_ORDER_COUNT}). Cannot update.`);
      return;
    }

    // Get menu summary
    const menuSummary = await getMenuSummary(orderDate);
    const submissionId = await getSubmissionId(orderDate);

    console.log(`Updating order for ${orderDate}:`, menuSummary);

    // Update with retry logic
    const result = await updateWithRetry(orderDate, menuSummary, submissionId || undefined);

    if (result.success) {
      // Update submission ID if changed
      if (result.submissionId && result.submissionId !== submissionId) {
        await markOrderAsSubmitted(orderDate, result.submissionId);
      }
      console.log(`Successfully updated order for ${orderDate}`);

      // Notify success
      if (channelId) {
        await notifyUpdateSuccess(channelId, orderDate, menuSummary);
      }
    } else {
      console.error(`Failed to update order for ${orderDate}:`, result.error);

      // Notify failure
      if (channelId) {
        await notifySubmissionFailure(channelId, orderDate, result.error, result.screenshotPath);
      }
    }
  } catch (error) {
    console.error('Error in updateSubmittedOrder:', error);
  }
}

/**
 * Submit order with retry logic
 */
async function submitWithRetry(
  orderDate: string,
  menuSummary: { 가정식: number; 프레시밀: number },
  retryCount: number = 0
): Promise<any> {
  const result = await submitOrder(orderDate, menuSummary);

  if (!result.success && retryCount < MAX_RETRIES) {
    console.log(`Submission failed (attempt ${retryCount + 1}/${MAX_RETRIES}). Retrying in ${RETRY_DELAY_MS / 1000}s...`);

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));

    // Retry
    return submitWithRetry(orderDate, menuSummary, retryCount + 1);
  }

  return result;
}

/**
 * Update order with retry logic
 */
async function updateWithRetry(
  orderDate: string,
  menuSummary: { 가정식: number; 프레시밀: number },
  submissionId?: string,
  retryCount: number = 0
): Promise<any> {
  const result = await updateOrder(orderDate, menuSummary, submissionId);

  if (!result.success && retryCount < MAX_RETRIES) {
    console.log(`Update failed (attempt ${retryCount + 1}/${MAX_RETRIES}). Retrying in ${RETRY_DELAY_MS / 1000}s...`);

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));

    // Retry
    return updateWithRetry(orderDate, menuSummary, submissionId, retryCount + 1);
  }

  return result;
}

/**
 * Notify that minimum order count not met
 */
async function notifyMinimumNotMet(channelId: string, currentCount: number): Promise<void> {
  try {
    await app.client.chat.postMessage({
      channel: channelId,
      text: `⚠️ 최소 주문 수량(${MINIMUM_ORDER_COUNT}개)에 미달하여 실제 주문이 제출되지 않았습니다.\n현재 주문: ${currentCount}개`,
    });
  } catch (error) {
    console.error('Failed to notify minimum not met:', error);
  }
}

/**
 * Notify submission success
 */
async function notifySubmissionSuccess(
  channelId: string,
  orderDate: string,
  menuSummary: { 가정식: number; 프레시밀: number }
): Promise<void> {
  try {
    await app.client.chat.postMessage({
      channel: channelId,
      text: `✅ Lunchlab 주문이 자동으로 제출되었습니다!\n날짜: ${orderDate}\n🍚 가정식: ${menuSummary.가정식}개\n🥗 프레시밀: ${menuSummary.프레시밀}개`,
    });
  } catch (error) {
    console.error('Failed to notify submission success:', error);
  }
}

/**
 * Notify update success
 */
async function notifyUpdateSuccess(
  channelId: string,
  orderDate: string,
  menuSummary: { 가정식: number; 프레시밀: number }
): Promise<void> {
  try {
    await app.client.chat.postMessage({
      channel: channelId,
      text: `🔄 Lunchlab 주문이 수정되었습니다.\n날짜: ${orderDate}\n🍚 가정식: ${menuSummary.가정식}개\n🥗 프레시밀: ${menuSummary.프레시밀}개`,
    });
  } catch (error) {
    console.error('Failed to notify update success:', error);
  }
}

/**
 * Notify submission failure (with admin mention)
 */
async function notifySubmissionFailure(
  channelId: string,
  orderDate: string,
  error?: string,
  screenshotPath?: string
): Promise<void> {
  try {
    const adminIds = process.env.SLACK_ADMIN_IDS?.split(',') || [];
    const adminMentions = adminIds.map(id => `<@${id.trim()}>`).join(' ');

    let text = `❌ Lunchlab 주문 제출에 실패했습니다. ${adminMentions}\n날짜: ${orderDate}`;

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
    console.error('Failed to notify submission failure:', error);
  }
}
