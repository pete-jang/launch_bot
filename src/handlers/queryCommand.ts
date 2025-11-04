import { app, isAllowedChannel } from '../bot';
import {
  getTodayOrders,
  getMenuSummary,
  getOrdersForDate,
  getOrdersForPeriod,
} from '../storage/orders';
import { formatDate, getThisWeekRange, getThisMonthRange, isValidDate, parseDateRange } from '../utils/time';
import { createTodayOrderBlocks, createPeriodOrderBlocks } from '../utils/blocks';

/**
 * 주문 내역 조회 슬래시 커맨드 등록
 */
export function registerQueryCommand(): void {
  app.command('/주문내역', async ({ command, ack, respond }) => {
    await ack();

    try {
      // 채널 확인
      if (!isAllowedChannel(command.channel_id)) {
        await respond({
          text: '지정된 채널에서만 조회 가능합니다.',
          response_type: 'ephemeral',
        });
        return;
      }

      const param = command.text.trim();

      // 파라미터가 없으면 선택지 표시
      if (!param) {
        await respond({
          text: '📋 주문 내역 조회',
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '📋 주문 내역 조회',
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '조회할 기간을 선택해주세요:',
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '📅 오늘',
                    emoji: true,
                  },
                  style: 'primary',
                  value: 'today',
                  action_id: 'query_today',
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '📆 이번주',
                    emoji: true,
                  },
                  value: 'week',
                  action_id: 'query_week',
                },
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: '📆 이번달',
                    emoji: true,
                  },
                  value: 'month',
                  action_id: 'query_month',
                },
              ],
            },
            {
              type: 'divider',
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: '💡 *직접 입력 조회*\n• 특정 날짜: `/주문내역 YYYY-MM-DD` (예: `/주문내역 2025-10-30`)\n• 기간 지정: `/주문내역 YYYY-MM-DD~YYYY-MM-DD` (예: `/주문내역 2025-10-01~2025-10-31`)',
                },
              ],
            },
          ],
          response_type: 'ephemeral',
        });
        return;
      }

      // 파라미터에 따라 조회 범위 결정
      if (param === '오늘') {
        // 오늘 주문 내역
        const today = formatDate();
        const todayOrders = await getTodayOrders();
        const menuSummary = await getMenuSummary();

        if (todayOrders.orders.length === 0) {
          await respond({
            text: `${today}에 주문 내역이 없습니다.`,
            response_type: 'ephemeral',
          });
          return;
        }

        const blocks = createTodayOrderBlocks(today, todayOrders, menuSummary);

        await respond({
          text: `📋 ${today} 주문 내역`,
          blocks: blocks,
          response_type: 'ephemeral',
        });

      } else if (param === '이번주') {
        // 이번주 주문 내역
        const { start, end } = getThisWeekRange();
        const periodSummary = await getOrdersForPeriod(start, end);

        const blocks = createPeriodOrderBlocks('📅 이번주 주문 내역', periodSummary, start, end);

        await respond({
          text: '📅 이번주 주문 내역',
          blocks: blocks,
          response_type: 'ephemeral',
        });

      } else if (param === '이번달' || param === '한달') {
        // 이번달 식사 내역 (식사일 기준)
        const { start, end } = getThisMonthRange();
        const periodSummary = await getOrdersForPeriod(start, end);

        const blocks = createPeriodOrderBlocks('📆 이번달 식사 내역', periodSummary, start, end);

        await respond({
          text: '📆 이번달 식사 내역',
          blocks: blocks,
          response_type: 'ephemeral',
        });

      } else {
        // 날짜 범위 또는 특정 날짜 확인
        const dateRange = parseDateRange(param);

        if (dateRange) {
          // 날짜 범위 조회
          const periodSummary = await getOrdersForPeriod(dateRange.start, dateRange.end);
          const blocks = createPeriodOrderBlocks(
            `📊 기간별 주문 내역`,
            periodSummary,
            dateRange.start,
            dateRange.end
          );

          await respond({
            text: '📊 기간별 주문 내역',
            blocks: blocks,
            response_type: 'ephemeral',
          });

        } else if (isValidDate(param)) {
          // 특정 날짜 주문 내역
          const dayOrders = await getOrdersForDate(param);
          const menuSummary = await getMenuSummary(param);

          if (dayOrders.orders.length === 0) {
            await respond({
              text: `${param}에 주문 내역이 없습니다.`,
              response_type: 'ephemeral',
            });
            return;
          }

          const blocks = createTodayOrderBlocks(param, dayOrders, menuSummary);

          await respond({
            text: `📋 ${param} 주문 내역`,
            blocks: blocks,
            response_type: 'ephemeral',
          });

        } else {
          // 잘못된 파라미터
          await respond({
            text: `잘못된 입력 형식입니다.\n\n사용법:\n• \`/주문내역\` - 기간 선택 메뉴 표시\n• \`/주문내역 YYYY-MM-DD\` - 특정 날짜 (예: 2025-10-30)\n• \`/주문내역 YYYY-MM-DD~YYYY-MM-DD\` - 기간 지정 (예: 2025-10-01~2025-10-31)`,
            response_type: 'ephemeral',
          });
        }
      }

      console.log(`Query command executed by ${command.user_id} with param: "${param}"`);
    } catch (error) {
      console.error('Error handling query command:', error);
      await respond({
        text: '조회 중 오류가 발생했습니다.',
        response_type: 'ephemeral',
      });
    }
  });

  // 버튼 클릭 액션 핸들러 - 오늘
  app.action('query_today', async ({ ack, body, client }) => {
    await ack();

    try {
      const today = formatDate();
      const todayOrders = await getTodayOrders();
      const menuSummary = await getMenuSummary();

      if (todayOrders.orders.length === 0) {
        await client.chat.postEphemeral({
          channel: (body as any).channel.id,
          user: (body as any).user.id,
          text: `${today}에 주문 내역이 없습니다.`,
        });
        return;
      }

      const blocks = createTodayOrderBlocks(today, todayOrders, menuSummary);

      await client.chat.postEphemeral({
        channel: (body as any).channel.id,
        user: (body as any).user.id,
        text: `📋 ${today} 주문 내역`,
        blocks: blocks,
      });

      console.log(`Query today executed by ${(body as any).user.id}`);
    } catch (error) {
      console.error('Error handling query_today action:', error);
    }
  });

  // 버튼 클릭 액션 핸들러 - 이번주
  app.action('query_week', async ({ ack, body, client }) => {
    await ack();

    try {
      const { start, end } = getThisWeekRange();
      const periodSummary = await getOrdersForPeriod(start, end);
      const blocks = createPeriodOrderBlocks('📅 이번주 주문 내역', periodSummary, start, end);

      await client.chat.postEphemeral({
        channel: (body as any).channel.id,
        user: (body as any).user.id,
        text: '📅 이번주 주문 내역',
        blocks: blocks,
      });

      console.log(`Query week executed by ${(body as any).user.id}`);
    } catch (error) {
      console.error('Error handling query_week action:', error);
    }
  });

  // 버튼 클릭 액션 핸들러 - 이번달
  app.action('query_month', async ({ ack, body, client }) => {
    await ack();

    try {
      const { start, end } = getThisMonthRange();
      const periodSummary = await getOrdersForPeriod(start, end);
      const blocks = createPeriodOrderBlocks('📆 이번달 식사 내역', periodSummary, start, end);

      await client.chat.postEphemeral({
        channel: (body as any).channel.id,
        user: (body as any).user.id,
        text: '📆 이번달 식사 내역',
        blocks: blocks,
      });

      console.log(`Query month executed by ${(body as any).user.id}`);
    } catch (error) {
      console.error('Error handling query_month action:', error);
    }
  });
}
