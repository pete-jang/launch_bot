import { app, isAllowedChannel, getChannelId } from '../bot';
import { getTodayOrders } from '../storage/orders';
import { formatDate } from '../utils/time';

/**
 * 식사 도착 알림 슬래시 커맨드 등록
 */
export function registerDeliveryCommand(): void {
  app.command('/식사도착', async ({ command, ack, respond }) => {
    await ack();

    try {
      // 채널 확인
      if (!isAllowedChannel(command.channel_id)) {
        await respond({
          text: '애미야, 여기서는 알림 못 보낸다니까? 지정된 채널에서만 하라 했잖니...',
          response_type: 'ephemeral',
        });
        return;
      }

      const today = formatDate();
      const todayOrders = getTodayOrders();

      // 주문이 없는 경우
      if (todayOrders.orders.length === 0) {
        await respond({
          text: '애미야, 오늘 주문한 사람이 없다니까? 누구한테 알림을 보내니?',
          response_type: 'ephemeral',
        });
        return;
      }

      // 주문자 멘션 리스트 생성
      const mentions = todayOrders.orders
        .map((order) => `<@${order.userId}>`)
        .join(' ');

      // 채널에 메시지 전송
      const channelId = getChannelId();
      await app.client.chat.postMessage({
        channel: channelId,
        text: `${mentions}\n\n애미야들, 밥 왔다! 얼른 가져가라!\n안 가져가면 식으니까 빨리 와!`,
      });

      // 명령 실행자에게 확인 메시지
      await respond({
        text: '애미야, 알림 보냈다... 이것도 내가 다 해야 되니?',
        response_type: 'ephemeral',
      });

      console.log(`Delivery notification sent by ${command.user_id} for ${todayOrders.orders.length} orders`);
    } catch (error) {
      console.error('Error handling delivery command:', error);
      await respond({
        text: '애미야, 알림 보내다가 에러 났다니까? 왜 이런 이상한 걸 시키고 그러니?',
        response_type: 'ephemeral',
      });
    }
  });
}
