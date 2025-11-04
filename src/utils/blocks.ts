import { DayOrders, PeriodOrdersSummary } from '../storage/orders';

/**
 * 오늘 주문 내역 블록 생성
 */
export function createTodayOrderBlocks(date: string, dayOrders: DayOrders, menuSummary: any): any[] {
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
export function createPeriodOrderBlocks(title: string, period: PeriodOrdersSummary, startDate: string, endDate: string): any[] {
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
