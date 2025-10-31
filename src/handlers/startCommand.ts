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
          text: '애미야, 주말에 이런 걸 시키고 그러니? 주말엔 주문 안 된다니까?',
          response_type: 'ephemeral',
        });
        return;
      }

      // 이미 주문 메시지가 전송되었는지 확인
      if (isMessageSent(today)) {
        await respond({
          text: '애미야, 오늘 벌써 보냈다니까 그래? 또 보내라고? 시애미를 종 부리듯 하네...',
          response_type: 'ephemeral',
        });
        return;
      }

      // 주문 메시지 전송
      await sendOrderMessage();

      await respond({
        text: '애미야, 메시지 보냈다... 이것도 내가 다 해야 되니?',
        response_type: 'ephemeral',
      });

      console.log(`Manual order started by ${command.user_id}`);
    } catch (error) {
      console.error('Error handling start command:', error);
      await respond({
        text: '애미야, 에러 났다니까? 이런 이상한 걸 시켜서 에러 나잖니?',
        response_type: 'ephemeral',
      });
    }
  });
}
