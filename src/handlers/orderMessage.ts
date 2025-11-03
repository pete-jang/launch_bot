import { app, getChannelId } from '../bot';
import { formatDate, formatDateTime, getCurrentKST } from '../utils/time';
import { saveMessageTimestamp, getTodayOrders, getMenuSummary } from '../storage/orders';

/**
 * 주문 메시지 블록 생성
 */
async function createOrderBlocks(): Promise<any[]> {
  const now = getCurrentKST();
  const todayOrders = await getTodayOrders();
  const menuSummary = await getMenuSummary();

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🍱 점심 주문',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${formatDate(now)}*\n2시까지 주문해주세요.`,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '📋 *메뉴 확인*\n<https://www.lunchlab.me/menu|메뉴 확인하기>',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*메뉴를 선택하세요:*',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🍚 가정식',
            emoji: true,
          },
          style: 'primary',
          value: '가정식',
          action_id: 'order_가정식',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🥗 프레시밀',
            emoji: true,
          },
          style: 'primary',
          value: '프레시밀',
          action_id: 'order_프레시밀',
        },
      ],
    },
    {
      type: 'divider',
    },
  ];

  // 현재 주문 현황 추가
  if (todayOrders.orders.length > 0) {
    const orderText = `*현재 주문 현황*\n가정식: ${menuSummary.가정식}개 | 프레시밀: ${menuSummary.프레시밀}개\n현재 ${todayOrders.orders.length}명이 주문했습니다`;

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: orderText,
      },
    });
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*아직 주문이 없습니다.*',
      },
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `마지막 업데이트: ${formatDateTime(now)}`,
      },
    ],
  });

  return blocks;
}

/**
 * 주문 메시지 전송
 */
export async function sendOrderMessage(): Promise<void> {
  try {
    const channelId = getChannelId();
    const blocks = await createOrderBlocks();

    const result = await app.client.chat.postMessage({
      channel: channelId,
      text: '🍱 오늘의 점심 주문이 시작되었습니다!',
      blocks: blocks,
    });

    // 메시지 타임스탬프 저장 (나중에 업데이트하기 위해)
    if (result.ts) {
      await saveMessageTimestamp(formatDate(), result.ts);
    }

    console.log(`[${formatDateTime()}] Order message sent successfully`);
  } catch (error) {
    console.error('Failed to send order message:', error);
    throw error;
  }
}

/**
 * 주문 메시지 업데이트
 */
export async function updateOrderMessage(messageTs: string): Promise<void> {
  try {
    const channelId = getChannelId();
    const blocks = await createOrderBlocks();

    await app.client.chat.update({
      channel: channelId,
      ts: messageTs,
      text: '🍱 오늘의 점심 주문',
      blocks: blocks,
    });

    console.log(`[${formatDateTime()}] Order message updated`);
  } catch (error) {
    console.error('Failed to update order message:', error);
    // 업데이트 실패는 치명적이지 않으므로 에러를 던지지 않음
  }
}

/**
 * 주문 마감 메시지 업데이트
 */
export async function sendClosedMessage(): Promise<void> {
  try {
    const channelId = getChannelId();
    const todayOrders = await getTodayOrders();
    const menuSummary = await getMenuSummary();

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔒 주문 마감',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${formatDate()}*`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*최종 주문 현황*\n🍚 가정식: ${menuSummary.가정식}개\n🥗 프레시밀: ${menuSummary.프레시밀}개\n\n총 ${todayOrders.orders.length}명이 주문했습니다.`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `마감 시간: ${formatDateTime()}`,
          },
        ],
      },
    ];

    // 기존 메시지가 있으면 업데이트, 없으면 새로 전송
    if (todayOrders.messageTs) {
      await app.client.chat.update({
        channel: channelId,
        ts: todayOrders.messageTs,
        text: '🔒 주문이 마감되었습니다',
        blocks: blocks,
      });
    } else {
      await app.client.chat.postMessage({
        channel: channelId,
        text: '🔒 주문이 마감되었습니다',
        blocks: blocks,
      });
    }

    console.log(`[${formatDateTime()}] Orders closed message sent`);
  } catch (error) {
    console.error('Failed to send closed message:', error);
  }
}
