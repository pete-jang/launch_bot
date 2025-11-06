import { app, isAllowedChannel } from "../bot";
import {
  addOrder,
  getOrdersForDate,
  Menu,
  isOrderSubmitted,
  cancelOrder,
  getOrderCountForDate,
} from "../storage/orders";
import { isOrderDeadlinePassed } from "../utils/time";
import { updateOrderMessage } from "./orderMessage";
import {
  submitOrdersIfReady,
  updateSubmittedOrder,
  cancelSubmittedOrder,
} from "../automation/submitter";

const MINIMUM_ORDER_COUNT = 3;

/**
 * 주문 버튼 인터랙션 등록
 */
export function registerOrderInteraction(): void {
  // 날짜가 포함된 주문 버튼 패턴 매칭
  app.action(
    /^order_(가정식|프레시밀)_(\d{4}-\d{2}-\d{2})$/,
    async ({ ack, body, client, action }) => {
      await ack();

      // action_id에서 메뉴와 날짜 추출
      const actionId = (action as any).action_id;
      const match = actionId.match(
        /^order_(가정식|프레시밀)_(\d{4}-\d{2}-\d{2})$/,
      );

      if (!match) {
        console.error("Invalid action_id format:", actionId);
        return;
      }

      const menu = match[1] as Menu;
      const mealDate = match[2];

      await handleOrder(body, client, menu, mealDate);
    },
  );

  // 주문 취소 버튼 핸들러
  app.action(
    /^cancel_order_(\d{4}-\d{2}-\d{2})$/,
    async ({ ack, body, client, action }) => {
      await ack();

      const actionId = (action as any).action_id;
      const match = actionId.match(/^cancel_order_(\d{4}-\d{2}-\d{2})$/);

      if (!match) {
        console.error("Invalid action_id format:", actionId);
        return;
      }

      const mealDate = match[1];
      await handleCancelOrder(body, client, mealDate);
    },
  );
}

/**
 * 주문 처리 로직
 * @param mealDate 식사 날짜
 */
async function handleOrder(
  body: any,
  client: any,
  menu: Menu,
  mealDate: string,
): Promise<void> {
  // Extract user info at function level for error handling access
  const userId = body.user.id;
  const userName = body.user.name || body.user.username || "알 수 없음";

  try {
    console.log(
      `[Order Handler] Processing order: user=${userId}, menu=${menu}, meal date=${mealDate}`,
    );

    // 채널 확인
    if (!isAllowedChannel(body.channel.id)) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: "지정된 채널에서만 주문 가능합니다.",
      });
      return;
    }

    // 해당 날짜의 주문 마감 확인
    if (isOrderDeadlinePassed(mealDate)) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: "주문 마감 시간(2시)이 지났습니다.",
      });
      return;
    }

    const orders = await getOrdersForDate(mealDate);

    // 이미 마감된 경우
    if (orders.closed) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: "이미 주문이 마감되었습니다.",
      });
      return;
    }

    // 기존 주문 확인 (주문 추가 전에 확인)
    const existingOrder = orders.orders.find(
      (order) => order.userId === userId,
    );

    // 주문 추가
    const success = await addOrder(userId, userName, menu, mealDate);

    if (!success) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: "주문 처리 중 오류가 발생했습니다.",
      });
      return;
    }
    const isUpdate = !!existingOrder;

    // 사용자에게 확인 메시지 전송 (본인만 볼 수 있음)
    if (isUpdate) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: `주문이 *${menu}*로 변경되었습니다. (이전: ${existingOrder.menu})`,
      });
    } else {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: `*${menu}* 주문이 완료되었습니다.`,
      });
    }

    // 주문 메시지 업데이트 (현황 반영)
    if (body.message?.ts) {
      await updateOrderMessage(body.message.ts, mealDate);
    }

    console.log(
      `Order received: ${userName} (${userId}) ordered ${menu} for meal date ${mealDate}`,
    );

    // 자동 제출 로직: 주문 3개 이상 시 자동으로 Lunchlab에 제출
    const alreadySubmitted = await isOrderSubmitted(mealDate);

    if (alreadySubmitted) {
      // 이미 제출된 경우, 수정 요청
      console.log(`Order already submitted for ${mealDate}, updating...`);
      await updateSubmittedOrder(mealDate, body.channel.id);
    } else {
      // 아직 제출되지 않은 경우, 최소 수량 확인 후 제출
      console.log(`Checking if ready to submit for ${mealDate}...`);
      await submitOrdersIfReady(mealDate, body.channel.id);
    }
  } catch (error) {
    console.error("[Order Handler] Error handling order:", error);

    // Notify user about the error
    try {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: "주문 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      });
    } catch (notifyError) {
      console.error(
        "[Order Handler] Failed to notify user about error:",
        notifyError,
      );
    }
  }
}

/**
 * 주문 취소 처리 로직
 * @param mealDate 식사 날짜
 */
async function handleCancelOrder(
  body: any,
  client: any,
  mealDate: string,
): Promise<void> {
  const userId = body.user.id;
  const userName = body.user.name || body.user.username || "알 수 없음";

  try {
    console.log(
      `[Cancel Handler] Processing cancellation: user=${userId}, meal date=${mealDate}`,
    );

    // 채널 확인
    if (!isAllowedChannel(body.channel.id)) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: "지정된 채널에서만 주문 취소가 가능합니다.",
      });
      return;
    }

    // 해당 날짜의 주문 마감 확인
    if (isOrderDeadlinePassed(mealDate)) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: "주문 마감 시간(2시)이 지났습니다.",
      });
      return;
    }

    const orders = await getOrdersForDate(mealDate);

    // 이미 마감된 경우
    if (orders.closed) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: "이미 주문이 마감되었습니다.",
      });
      return;
    }

    // 기존 주문 확인
    const existingOrder = orders.orders.find(
      (order) => order.userId === userId,
    );

    if (!existingOrder) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: "취소할 주문이 없습니다.",
      });
      return;
    }

    // 주문 취소
    const success = await cancelOrder(userId, mealDate);

    if (!success) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: "주문 취소 중 오류가 발생했습니다.",
      });
      return;
    }

    // 사용자에게 확인 메시지 전송
    await client.chat.postEphemeral({
      channel: body.channel.id,
      user: userId,
      text: `*${existingOrder.menu}* 주문이 취소되었습니다.`,
    });

    // 주문 메시지 업데이트
    if (body.message?.ts) {
      await updateOrderMessage(body.message.ts, mealDate);
    }

    console.log(
      `Order cancelled: ${userName} (${userId}) for meal date ${mealDate}`,
    );

    // Lunchlab 주문 처리
    const alreadySubmitted = await isOrderSubmitted(mealDate);
    if (alreadySubmitted) {
      const newCount = await getOrderCountForDate(mealDate);

      if (newCount < MINIMUM_ORDER_COUNT) {
        // 최소 수량 미달 - Lunchlab 주문 취소 필요
        console.log(
          `Order count below minimum after cancellation. Cancelling Lunchlab order...`,
        );
        await cancelSubmittedOrder(mealDate, body.channel.id);
      } else {
        // 최소 수량 충족 - Lunchlab 주문 수정
        console.log(`Updating Lunchlab order after cancellation...`);
        await updateSubmittedOrder(mealDate, body.channel.id);
      }
    }
  } catch (error) {
    console.error("[Cancel Handler] Error handling cancellation:", error);

    try {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: "주문 취소 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      });
    } catch (notifyError) {
      console.error(
        "[Cancel Handler] Failed to notify user about error:",
        notifyError,
      );
    }
  }
}
