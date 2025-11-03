import { app, isAllowedChannel } from '../bot';

/**
 * 식사 도착 알림 슬래시 커맨드 등록
 */
export function registerDeliveryCommand(): void {
  app.command('/식사도착', async ({ command, ack, respond, say }) => {
    await ack();

    try {
      // 채널 확인
      if (!isAllowedChannel(command.channel_id)) {
        await respond({
          text: '지정된 채널에서만 알림 전송이 가능합니다.',
          response_type: 'ephemeral',
        });
        return;
      }

      // 채널에 메시지 전송
      await say({
        text: '식사가 도착했습니다! 받아가세요.',
      });

      console.log(`Delivery notification sent by ${command.user_id}`);
    } catch (error) {
      console.error('Error handling delivery command:', error);
    }
  });
}
