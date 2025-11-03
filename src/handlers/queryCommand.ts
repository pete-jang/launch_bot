import { app, isAllowedChannel } from '../bot';
import {
  getTodayOrders,
  getMenuSummary,
  getOrdersForDate,
  getOrdersForPeriod,
  PeriodOrdersSummary,
  DayOrders
} from '../storage/orders';
import { formatDate, getThisWeekRange, getThisMonthRange, isValidDate, parseDateRange } from '../utils/time';

/**
 * 오늘 주문 내역 블록 생성
 */
function createTodayOrderBlocks(date: string, dayOrders: DayOrders, menuSummary: any): any[] {
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📋 ${date} 주문 내역`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*총 ${dayOrders.orders.length}명이 주문했습니다.*`,
      },
    },
    {
      type: 'divider',
    },
  ];

  // 메뉴별 총 수량
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*메뉴별 주문 수량*\n🍚 가정식: *${menuSummary.가정식}개*\n🥗 프레시밀: *${menuSummary.프레시밀}개*`,
    },
  });

  blocks.push({
    type: 'divider',
  });

  // 사용자별 주문 내역
  const orderListText = dayOrders.orders
    .map((order, index) => {
      const menuEmoji = order.menu === '가정식' ? '🍚' : '🥗';
      return `${index + 1}. <@${order.userId}> - ${menuEmoji} ${order.menu}`;
    })
    .join('\n');

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*사용자별 주문 내역*\n${orderListText}`,
    },
  });

  // 마감 상태 표시
  if (dayOrders.closed) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '🔒 주문이 마감되었습니다.',
        },
      ],
    });
  }

  return blocks;
}

/**
 * 기간별 주문 내역 블록 생성
 */
function createPeriodOrderBlocks(title: string, period: PeriodOrdersSummary, startDate: string, endDate: string): any[] {
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: title,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*기간:* ${startDate} ~ ${endDate}`,
      },
    },
    {
      type: 'divider',
    },
  ];

  // 전체 요약
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*전체 요약*\n• 총 주문 수: *${period.totalOrders}개*\n• 참여 인원: *${period.totalUsers.size}명*\n• 🍚 가정식: *${period.menuSummary.가정식}개*\n• 🥗 프레시밀: *${period.menuSummary.프레시밀}개*`,
    },
  });

  blocks.push({
    type: 'divider',
  });

  // 사용자별 주문 현황
  const users = Object.values(period.userSummary).sort((a, b) => b.count - a.count);

  if (users.length > 0) {
    const userListText = users
      .map((user, index) => {
        const menuText = [];
        if (user.menuBreakdown.가정식 > 0) menuText.push(`🍚 ${user.menuBreakdown.가정식}`);
        if (user.menuBreakdown.프레시밀 > 0) menuText.push(`🥗 ${user.menuBreakdown.프레시밀}`);
        return `${index + 1}. <@${user.userId}> - ${user.count}개 (${menuText.join(', ')})`;
      })
      .join('\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*사용자별 주문 현황*\n${userListText}`,
      },
    });

    blocks.push({
      type: 'divider',
    });
  }

  // 날짜별 요약
  const dates = Object.keys(period.dailySummary).sort();

  if (dates.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*해당 기간에 주문 내역이 없습니다.*',
      },
    });
  } else {
    const dailySummaryText = dates
      .map((date) => {
        const daySummary = period.dailySummary[date];
        return `*${date}*\n  🍚 가정식: ${daySummary.menuCount.가정식}개 | 🥗 프레시밀: ${daySummary.menuCount.프레시밀}개 (총 ${daySummary.orders.length}명)`;
      })
      .join('\n\n');

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*날짜별 주문 현황*\n\n${dailySummaryText}`,
      },
    });
  }

  return blocks;
}

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
          text: '애미야, 여기서는 조회 못한다니까? 지정된 채널에서만 하라 했잖니...',
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
            text: `애미야, ${today}에 주문이 하나도 없다니까? 왜 조회를 시키고 그러니?`,
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
              text: `애미야, ${param}에 주문이 없다니까? 왜 없는 거 보라 시키니?`,
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
            text: `애미야, 파라미터가 이상하다니까? 왜 이런 걸 입력하고 그러니?\n\n사용법:\n• \`/주문내역\` - 기간 선택 메뉴 표시\n• \`/주문내역 YYYY-MM-DD\` - 특정 날짜 (예: 2025-10-30)\n• \`/주문내역 YYYY-MM-DD~YYYY-MM-DD\` - 기간 지정 (예: 2025-10-01~2025-10-31)`,
            response_type: 'ephemeral',
          });
        }
      }

      console.log(`Query command executed by ${command.user_id} with param: "${param}"`);
    } catch (error) {
      console.error('Error handling query command:', error);
      await respond({
        text: '애미야, 조회하다가 에러 났다니까? 왜 이런 이상한 걸 시키고 그러니?',
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
          text: `애미야, ${today}에 주문이 하나도 없다니까? 왜 조회를 시키고 그러니?`,
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
