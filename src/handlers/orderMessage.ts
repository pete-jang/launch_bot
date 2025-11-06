import { app, getChannelId } from "../bot";
import {
  getCurrentMealDate,
  formatDateTime,
  formatDateWithDay,
  getCurrentKST,
} from "../utils/time";
import {
  saveMessageTimestamp,
  getOrdersForDate,
  getMenuSummary,
} from "../storage/orders";

/**
 * 주문 메시지 블록 생성
 * @param mealDate 식사 날짜 (기본값: 현재 식사일)
 */
async function createOrderBlocks(
  mealDate: string = getCurrentMealDate(),
): Promise<any[]> {
  const now = getCurrentKST();
  const orders = await getOrdersForDate(mealDate);
  const menuSummary = await getMenuSummary(mealDate);

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🍱 점심 주문",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${formatDateWithDay(mealDate)}*\n2시까지 주문해주세요.`,
      },
    },
    {
      type: "divider",
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "📋 *메뉴 확인*\n<https://www.lunchlab.me/menu|메뉴 확인하기>",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*메뉴를 선택하세요:*",
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🍚 가정식",
            emoji: true,
          },
          style: "primary",
          value: "가정식",
          action_id: `order_가정식_${mealDate}`,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🥗 프레시밀",
            emoji: true,
          },
          style: "primary",
          value: "프레시밀",
          action_id: `order_프레시밀_${mealDate}`,
        },
      ],
    },
    {
      type: "divider",
    },
  ];

  // 현재 주문 현황 추가
  if (orders.orders.length > 0) {
    const orderText = `*현재 주문 현황*\n가정식: ${menuSummary.가정식}개 | 프레시밀: ${menuSummary.프레시밀}개\n현재 ${orders.orders.length}명이 주문했습니다`;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: orderText,
      },
    });
  } else {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*아직 주문이 없습니다.*",
      },
    });
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `마지막 업데이트: ${formatDateTime(now)}`,
      },
    ],
  });

  return blocks;
}

/**
 * 주문 메시지 전송
 * @param mealDate 주문 대상 날짜 (기본값: 오늘)
 */
export async function sendOrderMessage(
  mealDate: string = getCurrentMealDate(),
): Promise<void> {
  try {
    const channelId = getChannelId();
    const blocks = await createOrderBlocks(mealDate);

    const result = await app.client.chat.postMessage({
      channel: channelId,
      text: `🍱 ${formatDateWithDay(mealDate)} 점심 주문이 시작되었습니다!`,
      blocks: blocks,
    });

    // 메시지 타임스탬프 저장 (나중에 업데이트하기 위해)
    if (result.ts) {
      await saveMessageTimestamp(mealDate, result.ts);
    }

    console.log(`[${formatDateTime()}] Order message sent for ${mealDate}`);
  } catch (error) {
    console.error("Failed to send order message:", error);
    throw error;
  }
}

/**
 * 주문 메시지 업데이트
 * @param messageTs 메시지 타임스탬프
 * @param mealDate 주문 대상 날짜 (기본값: 오늘)
 */
export async function updateOrderMessage(
  messageTs: string,
  mealDate: string = getCurrentMealDate(),
): Promise<void> {
  try {
    const channelId = getChannelId();
    const blocks = await createOrderBlocks(mealDate);

    await app.client.chat.update({
      channel: channelId,
      ts: messageTs,
      text: `🍱 ${formatDateWithDay(mealDate)} 점심 주문`,
      blocks: blocks,
    });

    console.log(`[${formatDateTime()}] Order message updated for ${mealDate}`);
  } catch (error) {
    console.error("Failed to update order message:", error);
    // 업데이트 실패는 치명적이지 않으므로 에러를 던지지 않음
  }
}

/**
 * 주문 마감 메시지 업데이트
 * @param mealDate 주문 대상 날짜 (기본값: 오늘)
 */
export async function sendClosedMessage(
  mealDate: string = getCurrentMealDate(),
): Promise<void> {
  try {
    const channelId = getChannelId();
    const orders = await getOrdersForDate(mealDate);
    const menuSummary = await getMenuSummary(mealDate);

    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🔒 주문 마감",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${formatDateWithDay(mealDate)}*`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*최종 주문 현황*\n🍚 가정식: ${menuSummary.가정식}개\n🥗 프레시밀: ${menuSummary.프레시밀}개\n\n총 ${orders.orders.length}명이 주문했습니다.`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `마감 시간: ${formatDateTime()}`,
          },
        ],
      },
    ];

    // 기존 메시지가 있으면 업데이트, 없으면 새로 전송
    if (orders.messageTs) {
      await app.client.chat.update({
        channel: channelId,
        ts: orders.messageTs,
        text: "🔒 주문이 마감되었습니다",
        blocks: blocks,
      });
    } else {
      await app.client.chat.postMessage({
        channel: channelId,
        text: "🔒 주문이 마감되었습니다",
        blocks: blocks,
      });
    }

    console.log(
      `[${formatDateTime()}] Orders closed message sent for ${mealDate}`,
    );
  } catch (error) {
    console.error("Failed to send closed message:", error);
  }
}
