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
          text: '애미야, 여기서는 알림 못 보낸다니까? 지정된 채널에서만 하라 했잖니...',
          response_type: 'ephemeral',
        });
        return;
      }

      // 채널에 메시지 전송
      await say({
        text: '밥 왔다! 국 다 식겠다! 얼른 챙겨가려무니라!',
      });

      console.log(`Delivery notification sent by ${command.user_id}`);
    } catch (error) {
      console.error('Error handling delivery command:', error);
    }
  });
}
