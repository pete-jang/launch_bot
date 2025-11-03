import { app, isAllowedChannel } from '../bot';
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
      // 채널 확인
      if (!isAllowedChannel(command.channel_id)) {
        await respond({
          text: '지정된 채널에서만 주문 시작이 가능합니다.',
          response_type: 'ephemeral',
        });
        return;
      }

      const today = formatDate();

      // 평일 체크
      if (!isTodayWeekday()) {
        await respond({
          text: '주말에는 주문을 받지 않습니다.',
          response_type: 'ephemeral',
        });
        return;
      }

      // 이미 주문 메시지가 전송되었는지 확인
      if (await isMessageSent(today)) {
        await respond({
          text: '오늘 이미 주문 메시지가 전송되었습니다.',
          response_type: 'ephemeral',
        });
        return;
      }

      // 주문 메시지 전송
      await sendOrderMessage();

      await respond({
        text: '주문 메시지가 전송되었습니다.',
        response_type: 'ephemeral',
      });

      console.log(`Manual order started by ${command.user_id}`);
    } catch (error) {
      console.error('Error handling start command:', error);
      await respond({
        text: '오류가 발생했습니다.',
        response_type: 'ephemeral',
      });
    }
  });
}
