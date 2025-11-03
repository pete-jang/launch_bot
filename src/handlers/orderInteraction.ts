import { app, isAllowedChannel } from '../bot';
import { addOrder, getTodayOrders, Menu } from '../storage/orders';
import { isAfterOrderDeadline } from '../utils/time';
import { updateOrderMessage } from './orderMessage';

/**
 * 주문 버튼 인터랙션 등록
 */
export function registerOrderInteraction(): void {
  // 가정식 주문
  app.action('order_가정식', async ({ ack, body, client }) => {
    await ack();
    await handleOrder(body, client, '가정식');
  });

  // 프레시밀 주문
  app.action('order_프레시밀', async ({ ack, body, client }) => {
    await ack();
    await handleOrder(body, client, '프레시밀');
  });
}

/**
 * 주문 처리 로직
 */
async function handleOrder(body: any, client: any, menu: Menu): Promise<void> {
  try {
    const userId = body.user.id;
    const userName = body.user.name || body.user.username || '알 수 없음';

    // 채널 확인
    if (!isAllowedChannel(body.channel.id)) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: '지정된 채널에서만 주문 가능합니다.',
      });
      return;
    }

    // 주문 마감 확인
    if (isAfterOrderDeadline()) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: '주문 마감 시간(2시)이 지났습니다.',
      });
      return;
    }

    const todayOrders = await getTodayOrders();

    // 이미 마감된 경우
    if (todayOrders.closed) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: '이미 주문이 마감되었습니다.',
      });
      return;
    }

    // 기존 주문 확인 (주문 추가 전에 확인)
    const existingOrder = todayOrders.orders.find((order) => order.userId === userId);

    // 주문 추가
    const success = await addOrder(userId, userName, menu);

    if (!success) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: userId,
        text: '주문 처리 중 오류가 발생했습니다.',
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
      await updateOrderMessage(body.message.ts);
    }

    console.log(`Order received: ${userName} (${userId}) ordered ${menu}`);
  } catch (error) {
    console.error('Error handling order:', error);
  }
}
