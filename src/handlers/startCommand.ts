import { app } from '../bot';
import { sendOrderMessage } from './orderMessage';
import { isMessageSent } from '../storage/orders';
import { formatDate, isTodayWeekday } from '../utils/time';

/**
 * 주문 시작 슬래시 커맨드 등록
 */
export function registerStartCommand(): void {
  app.command('/주문시작', async ({ command, ack, respond }) => {
    await ack();

    try {
      const today = formatDate();

      // 평일 체크
      if (!isTodayWeekday()) {
        await respond({
          text: '⚠️ 주말에는 주문을 받을 수 없습니다. 평일에만 주문이 가능합니다.',
          response_type: 'ephemeral',
        });
        return;
      }

      // 이미 주문 메시지가 전송되었는지 확인
      if (isMessageSent(today)) {
        await respond({
          text: '⚠️ 오늘 이미 주문 메시지가 전송되었습니다.',
          response_type: 'ephemeral',
        });
        return;
      }

      // 주문 메시지 전송
      await sendOrderMessage();

      await respond({
        text: '✅ 주문 메시지가 전송되었습니다!',
        response_type: 'ephemeral',
      });

      console.log(`Manual order started by ${command.user_id}`);
    } catch (error) {
      console.error('Error handling start command:', error);
      await respond({
        text: '❌ 주문 메시지를 전송하는 중 오류가 발생했습니다.',
        response_type: 'ephemeral',
      });
    }
  });
}
