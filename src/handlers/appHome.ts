import { app } from '../bot';
import { getTodayOrders, getMenuSummary, getOrdersForPeriod } from '../storage/orders';
import { formatDate, getThisWeekRange, getThisMonthRange } from '../utils/time';
import { createTodayOrderBlocks, createPeriodOrderBlocks } from '../utils/blocks';

/**
 * 앱 홈 탭 이벤트 핸들러 등록
 */
export function registerAppHome(): void {
  // 앱 홈 열림 이벤트
  app.event('app_home_opened', async ({ event, client }) => {
    try {
      const today = formatDate();
      const todayOrders = await getTodayOrders();
      const menuSummary = await getMenuSummary();

      // 홈 탭 뷰 구성
      const blocks: any[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🍱 점심 주문 관리',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '주문 내역을 조회하고 관리할 수 있습니다.',
          },
        },
        {
          type: 'divider',
        },
      ];

      // 오늘 주문 내역 추가
      if (todayOrders.orders.length > 0) {
        const todayBlocks = createTodayOrderBlocks(today, todayOrders, menuSummary);
        blocks.push(...todayBlocks);
      } else {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*📋 ${today} 주문 내역*\n오늘은 아직 주문 내역이 없습니다.`,
          },
        });
      }

      // 기간별 조회 버튼
      blocks.push(
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*기간별 주문 내역 조회*',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📆 이번주',
                emoji: true,
              },
              value: 'week',
              action_id: 'home_query_week',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📆 이번달',
                emoji: true,
              },
              value: 'month',
              action_id: 'home_query_month',
            },
          ],
        }
      );

      // 홈 탭 업데이트
      await client.views.publish({
        user_id: event.user,
        view: {
          type: 'home',
          blocks: blocks,
        },
      });

      console.log(`App home opened by ${event.user}`);
    } catch (error) {
      console.error('Error handling app_home_opened:', error);
    }
  });

  // 홈 탭 - 이번주 버튼 클릭
  app.action('home_query_week', async ({ ack, body, client }) => {
    await ack();

    try {
      const { start, end } = getThisWeekRange();
      const periodSummary = await getOrdersForPeriod(start, end);

      const blocks: any[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🍱 점심 주문 관리',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '주문 내역을 조회하고 관리할 수 있습니다.',
          },
        },
        {
          type: 'divider',
        },
      ];

      // 이번주 주문 내역
      const periodBlocks = createPeriodOrderBlocks('📅 이번주 주문 내역', periodSummary, start, end);
      blocks.push(...periodBlocks);

      // 돌아가기 버튼
      blocks.push(
        {
          type: 'divider',
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '◀️ 오늘 주문으로 돌아가기',
                emoji: true,
              },
              value: 'back',
              action_id: 'home_back_to_today',
            },
          ],
        }
      );

      // 홈 탭 업데이트
      await client.views.publish({
        user_id: (body as any).user.id,
        view: {
          type: 'home',
          blocks: blocks,
        },
      });

      console.log(`Home query week by ${(body as any).user.id}`);
    } catch (error) {
      console.error('Error handling home_query_week:', error);
    }
  });

  // 홈 탭 - 이번달 버튼 클릭
  app.action('home_query_month', async ({ ack, body, client }) => {
    await ack();

    try {
      const { start, end } = getThisMonthRange();
      const periodSummary = await getOrdersForPeriod(start, end);

      const blocks: any[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🍱 점심 주문 관리',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '주문 내역을 조회하고 관리할 수 있습니다.',
          },
        },
        {
          type: 'divider',
        },
      ];

      // 이번달 주문 내역
      const periodBlocks = createPeriodOrderBlocks('📆 이번달 식사 내역', periodSummary, start, end);
      blocks.push(...periodBlocks);

      // 돌아가기 버튼
      blocks.push(
        {
          type: 'divider',
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '◀️ 오늘 주문으로 돌아가기',
                emoji: true,
              },
              value: 'back',
              action_id: 'home_back_to_today',
            },
          ],
        }
      );

      // 홈 탭 업데이트
      await client.views.publish({
        user_id: (body as any).user.id,
        view: {
          type: 'home',
          blocks: blocks,
        },
      });

      console.log(`Home query month by ${(body as any).user.id}`);
    } catch (error) {
      console.error('Error handling home_query_month:', error);
    }
  });

  // 홈 탭 - 오늘로 돌아가기 버튼
  app.action('home_back_to_today', async ({ ack, body, client }) => {
    await ack();

    try {
      const today = formatDate();
      const todayOrders = await getTodayOrders();
      const menuSummary = await getMenuSummary();

      const blocks: any[] = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🍱 점심 주문 관리',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '주문 내역을 조회하고 관리할 수 있습니다.',
          },
        },
        {
          type: 'divider',
        },
      ];

      // 오늘 주문 내역
      if (todayOrders.orders.length > 0) {
        const todayBlocks = createTodayOrderBlocks(today, todayOrders, menuSummary);
        blocks.push(...todayBlocks);
      } else {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*📋 ${today} 주문 내역*\n오늘은 아직 주문 내역이 없습니다.`,
          },
        });
      }

      // 기간별 조회 버튼
      blocks.push(
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*기간별 주문 내역 조회*',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📆 이번주',
                emoji: true,
              },
              value: 'week',
              action_id: 'home_query_week',
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '📆 이번달',
                emoji: true,
              },
              value: 'month',
              action_id: 'home_query_month',
            },
          ],
        }
      );

      // 홈 탭 업데이트
      await client.views.publish({
        user_id: (body as any).user.id,
        view: {
          type: 'home',
          blocks: blocks,
        },
      });

      console.log(`Home back to today by ${(body as any).user.id}`);
    } catch (error) {
      console.error('Error handling home_back_to_today:', error);
    }
  });
}
