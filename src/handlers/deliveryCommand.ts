import { app } from '../bot';

/**
 * 식사 도착 알림 슬래시 커맨드 등록
 */
export function registerDeliveryCommand(): void {
  app.command('/식사도착', async ({ command, ack, say }) => {
    await ack();

    try {
      // 채널에 메시지 전송
      await say({
        text: '애미야들, 밥 왔다! 얼른 가져가라!\n안 가져가면 식으니까 빨리 와!',
      });

      console.log(`Delivery notification sent by ${command.user_id}`);
    } catch (error) {
      console.error('Error handling delivery command:', error);
    }
  });
}
