import schedule from "node-schedule";
import { sendOrderMessage, sendClosedMessage } from "./handlers/orderMessage";
import { closeOrders, isMessageSent } from "./storage/orders";
import { isTodayWeekday, formatDateTime, formatDate } from "./utils/time";

/**
 * 주문 메시지 전송 작업 (매일 12시)
 */
function scheduleOrderMessage(): void {
  // 매일 12시 (평일만)
  schedule.scheduleJob("0 12 * * 1-5", async () => {
    try {
      if (!isTodayWeekday()) {
        console.log(
          `[${formatDateTime()}] Skipping order message (not a weekday)`,
        );
        return;
      }

      // 이미 수동으로 주문 메시지가 전송되었는지 확인
      if (await isMessageSent(formatDate())) {
        console.log(
          `[${formatDateTime()}] Skipping order message (already sent manually)`,
        );
        return;
      }

      console.log(`[${formatDateTime()}] Sending daily order message...`);
      await sendOrderMessage();
    } catch (error) {
      console.error("Error in order message job:", error);
    }
  });

  console.log("📅 Scheduled: Daily order message at 12:00 PM (Mon-Fri)");
}

/**
 * 주문 마감 작업 (매일 14시)
 */
function scheduleOrderClose(): void {
  // 매일 14시 (평일만)
  schedule.scheduleJob("0 14 * * 1-5", async () => {
    try {
      if (!isTodayWeekday()) {
        console.log(
          `[${formatDateTime()}] Skipping order close (not a weekday)`,
        );
        return;
      }

      console.log(`[${formatDateTime()}] Closing orders...`);
      await closeOrders();
      await sendClosedMessage();
    } catch (error) {
      console.error("Error in order close job:", error);
    }
  });

  console.log("📅 Scheduled: Order close at 2:00 PM (Mon-Fri)");
}

/**
 * 모든 스케줄 작업 시작
 */
export function startScheduler(): void {
  console.log("🕐 Starting scheduler...");
  scheduleOrderMessage();
  scheduleOrderClose();
  console.log("✅ Scheduler started successfully");
}

/**
 * 모든 스케줄 작업 중지
 */
export function stopScheduler(): void {
  schedule.gracefulShutdown();
  console.log("🛑 Scheduler stopped");
}
