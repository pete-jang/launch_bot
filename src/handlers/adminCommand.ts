import { app, isAdminUser } from '../bot';
import { markOrderAsSubmitted, isOrderSubmitted } from '../storage/orders';
import { formatDate } from '../utils/time';

/**
 * 관리자 전용 커맨드 등록
 * - DB 상태 수정 등 관리 작업
 */
export function registerAdminCommand(): void {
  // DB submitted 상태 수정 커맨드
  app.command('/주문상태수정', async ({ command, ack, respond, client }) => {
    await ack();

    const userId = command.user_id;

    // 관리자 권한 확인
    if (!isAdminUser(userId)) {
      await respond({
        text: '❌ 관리자만 사용할 수 있는 커맨드입니다.',
        response_type: 'ephemeral',
      });
      return;
    }

    try {
      // 커맨드 형식: /주문상태수정 2025-11-05 submitted
      const args = command.text.trim().split(/\s+/);

      if (args.length < 2) {
        await respond({
          text: '사용법: `/주문상태수정 <날짜> <상태>`\n예: `/주문상태수정 2025-11-05 submitted`',
          response_type: 'ephemeral',
        });
        return;
      }

      const orderDate = args[0];
      const status = args[1];

      // 날짜 형식 검증 (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
        await respond({
          text: '❌ 날짜 형식이 올바르지 않습니다. (예: 2025-11-05)',
          response_type: 'ephemeral',
        });
        return;
      }

      if (status === 'submitted') {
        // 현재 상태 확인
        const currentStatus = await isOrderSubmitted(orderDate);

        await markOrderAsSubmitted(orderDate, orderDate);

        await respond({
          text: `✅ ${orderDate}의 주문 상태를 submitted로 변경했습니다.\n이전 상태: ${currentStatus ? 'submitted' : 'not submitted'}`,
          response_type: 'ephemeral',
        });
      } else {
        await respond({
          text: '❌ 지원하지 않는 상태입니다. 현재는 "submitted"만 지원합니다.',
          response_type: 'ephemeral',
        });
      }
    } catch (error) {
      console.error('Error in /주문상태수정:', error);
      await respond({
        text: '❌ 주문 상태 수정 중 오류가 발생했습니다.',
        response_type: 'ephemeral',
      });
    }
  });

  // DB 상태 조회 커맨드
  app.command('/주문상태조회', async ({ command, ack, respond }) => {
    await ack();

    const userId = command.user_id;

    // 관리자 권한 확인
    if (!isAdminUser(userId)) {
      await respond({
        text: '❌ 관리자만 사용할 수 있는 커맨드입니다.',
        response_type: 'ephemeral',
      });
      return;
    }

    try {
      const args = command.text.trim().split(/\s+/);
      const orderDate = args[0] || formatDate();

      // 날짜 형식 검증
      if (!/^\d{4}-\d{2}-\d{2}$/.test(orderDate)) {
        await respond({
          text: '❌ 날짜 형식이 올바르지 않습니다. (예: 2025-11-05)',
          response_type: 'ephemeral',
        });
        return;
      }

      const isSubmitted = await isOrderSubmitted(orderDate);

      await respond({
        text: `📊 ${orderDate} 주문 상태\nLunchlab 제출 여부: ${isSubmitted ? '✅ 제출됨' : '❌ 미제출'}`,
        response_type: 'ephemeral',
      });
    } catch (error) {
      console.error('Error in /주문상태조회:', error);
      await respond({
        text: '❌ 주문 상태 조회 중 오류가 발생했습니다.',
        response_type: 'ephemeral',
      });
    }
  });
}
