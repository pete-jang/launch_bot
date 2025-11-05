import { app, isAllowedChannel } from "../bot";
import {
  getTodayOrders,
  getMenuSummary,
  getOrdersForDate,
  getOrdersForPeriod,
} from "../storage/orders";
import {
  formatDate,
  getThisWeekRange,
  getThisMonthRange,
  validateDateRange,
} from "../utils/time";
import {
  createTodayOrderBlocks,
  createPeriodOrderBlocks,
} from "../utils/blocks";

/**
 * 주문 내역 조회 모달 뷰 생성
 */
function createQueryModal() {
  return {
    type: "modal" as const,
    callback_id: "query_modal",
    title: {
      type: "plain_text" as const,
      text: "📋 주문 내역 조회",
      emoji: true,
    },
    submit: {
      type: "plain_text" as const,
      text: "조회하기",
      emoji: true,
    },
    close: {
      type: "plain_text" as const,
      text: "취소",
      emoji: true,
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*빠른 조회*\n아래 버튼을 눌러 바로 조회하거나, 사용자 정의 기간을 선택하세요.",
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📅 오늘",
              emoji: true,
            },
            style: "primary",
            value: "today",
            action_id: "query_modal_today",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📆 이번주",
              emoji: true,
            },
            value: "week",
            action_id: "query_modal_week",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📆 이번달",
              emoji: true,
            },
            value: "month",
            action_id: "query_modal_month",
          },
        ],
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*사용자 정의 기간*",
        },
      },
      {
        type: "input",
        block_id: "start_date_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "시작일",
          emoji: true,
        },
        element: {
          type: "datepicker",
          action_id: "start_date_picker",
          placeholder: {
            type: "plain_text",
            text: "시작 날짜를 선택하세요",
            emoji: true,
          },
        },
      },
      {
        type: "input",
        block_id: "end_date_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "종료일",
          emoji: true,
        },
        element: {
          type: "datepicker",
          action_id: "end_date_picker",
          placeholder: {
            type: "plain_text",
            text: "종료 날짜를 선택하세요",
            emoji: true,
          },
        },
      },
    ],
  };
}

/**
 * 주문 내역 조회 슬래시 커맨드 등록
 */
export function registerQueryCommand(): void {
  app.command("/주문내역", async ({ command, ack, client }) => {
    await ack();

    try {
      // 채널 확인
      if (!isAllowedChannel(command.channel_id)) {
        await client.chat.postEphemeral({
          channel: command.channel_id,
          user: command.user_id,
          text: "지정된 채널에서만 조회 가능합니다.",
        });
        return;
      }

      // 모달 열기
      await client.views.open({
        trigger_id: command.trigger_id,
        view: createQueryModal(),
      });

      console.log(`Query modal opened by ${command.user_id}`);
    } catch (error) {
      console.error("Error opening query modal:", error);
      await client.chat.postEphemeral({
        channel: command.channel_id,
        user: command.user_id,
        text: "조회 중 오류가 발생했습니다.",
      });
    }
  });

  // 모달 내 빠른 조회 버튼 핸들러 - 오늘
  app.action("query_modal_today", async ({ ack, body, client }) => {
    await ack();

    try {
      const today = formatDate();
      const todayOrders = await getTodayOrders();
      const menuSummary = await getMenuSummary();

      // 모달 닫기
      if ((body as any).view?.id) {
        await client.views.update({
          view_id: (body as any).view.id,
          view: {
            type: "modal",
            callback_id: "query_modal_closed",
            title: {
              type: "plain_text",
              text: "✓ 조회 완료",
              emoji: true,
            },
            close: {
              type: "plain_text",
              text: "닫기",
              emoji: true,
            },
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "오늘 주문 내역을 채널에서 확인하세요.",
                },
              },
            ],
          },
        });
      }

      // 결과 표시
      if (todayOrders.orders.length === 0) {
        await client.chat.postEphemeral({
          channel: (body as any).channel?.id || (body as any).user.id,
          user: (body as any).user.id,
          text: `${today}에 주문 내역이 없습니다.`,
        });
        return;
      }

      const blocks = createTodayOrderBlocks(today, todayOrders, menuSummary);

      await client.chat.postEphemeral({
        channel: (body as any).channel?.id || (body as any).user.id,
        user: (body as any).user.id,
        text: `📋 ${today} 주문 내역`,
        blocks: blocks,
      });

      console.log(`Query modal today executed by ${(body as any).user.id}`);
    } catch (error) {
      console.error("Error handling query_modal_today action:", error);
    }
  });

  // 모달 내 빠른 조회 버튼 핸들러 - 이번주
  app.action("query_modal_week", async ({ ack, body, client }) => {
    await ack();

    try {
      const { start, end } = getThisWeekRange();
      const periodSummary = await getOrdersForPeriod(start, end);
      const blocks = createPeriodOrderBlocks(
        "📅 이번주 주문 내역",
        periodSummary,
        start,
        end,
      );

      // 모달 닫기
      if ((body as any).view?.id) {
        await client.views.update({
          view_id: (body as any).view.id,
          view: {
            type: "modal",
            callback_id: "query_modal_closed",
            title: {
              type: "plain_text",
              text: "✓ 조회 완료",
              emoji: true,
            },
            close: {
              type: "plain_text",
              text: "닫기",
              emoji: true,
            },
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "이번주 주문 내역을 채널에서 확인하세요.",
                },
              },
            ],
          },
        });
      }

      // 결과 표시
      await client.chat.postEphemeral({
        channel: (body as any).channel?.id || (body as any).user.id,
        user: (body as any).user.id,
        text: "📅 이번주 주문 내역",
        blocks: blocks,
      });

      console.log(`Query modal week executed by ${(body as any).user.id}`);
    } catch (error) {
      console.error("Error handling query_modal_week action:", error);
    }
  });

  // 모달 내 빠른 조회 버튼 핸들러 - 이번달
  app.action("query_modal_month", async ({ ack, body, client }) => {
    await ack();

    try {
      const { start, end } = getThisMonthRange();
      const periodSummary = await getOrdersForPeriod(start, end);
      const blocks = createPeriodOrderBlocks(
        "📆 이번달 식사 내역",
        periodSummary,
        start,
        end,
      );

      // 모달 닫기
      if ((body as any).view?.id) {
        await client.views.update({
          view_id: (body as any).view.id,
          view: {
            type: "modal",
            callback_id: "query_modal_closed",
            title: {
              type: "plain_text",
              text: "✓ 조회 완료",
              emoji: true,
            },
            close: {
              type: "plain_text",
              text: "닫기",
              emoji: true,
            },
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "이번달 식사 내역을 채널에서 확인하세요.",
                },
              },
            ],
          },
        });
      }

      // 결과 표시
      await client.chat.postEphemeral({
        channel: (body as any).channel?.id || (body as any).user.id,
        user: (body as any).user.id,
        text: "📆 이번달 식사 내역",
        blocks: blocks,
      });

      console.log(`Query modal month executed by ${(body as any).user.id}`);
    } catch (error) {
      console.error("Error handling query_modal_month action:", error);
    }
  });

  // 모달 제출 핸들러 (date picker로 사용자 정의 기간 선택 시)
  app.view("query_modal", async ({ ack, view, body, client }) => {
    try {
      // 입력값 추출
      const startDate =
        view.state.values.start_date_block?.start_date_picker?.selected_date;
      const endDate =
        view.state.values.end_date_block?.end_date_picker?.selected_date;

      // 유효성 검증
      if (!startDate && !endDate) {
        // 둘 다 선택 안 함
        await ack({
          response_action: "errors",
          errors: {
            start_date_block: "시작일 또는 종료일을 선택해주세요.",
          },
        });
        return;
      }

      if (startDate && !endDate) {
        // 시작일만 선택 - 해당 날짜의 주문 조회
        await ack();

        const dayOrders = await getOrdersForDate(startDate);
        const menuSummary = await getMenuSummary(startDate);

        if (dayOrders.orders.length === 0) {
          await client.chat.postEphemeral({
            channel: (body as any).user.id,
            user: (body as any).user.id,
            text: `${startDate}에 주문 내역이 없습니다.`,
          });
          return;
        }

        const blocks = createTodayOrderBlocks(
          startDate,
          dayOrders,
          menuSummary,
        );

        await client.chat.postEphemeral({
          channel: (body as any).user.id,
          user: (body as any).user.id,
          text: `📋 ${startDate} 주문 내역`,
          blocks: blocks,
        });

        console.log(
          `Query modal date ${startDate} executed by ${body.user.id}`,
        );
        return;
      }

      if (!startDate && endDate) {
        // 종료일만 선택
        await ack({
          response_action: "errors",
          errors: {
            start_date_block: "시작일을 선택해주세요.",
          },
        });
        return;
      }

      // 둘 다 선택된 경우 - 날짜 범위 검증
      const validation = validateDateRange(startDate!, endDate!);
      if (!validation.valid) {
        await ack({
          response_action: "errors",
          errors: {
            start_date_block:
              validation.error || "올바른 날짜 범위를 선택해주세요.",
          },
        });
        return;
      }

      // 유효한 날짜 범위 - 조회 실행
      await ack();

      const periodSummary = await getOrdersForPeriod(startDate!, endDate!);
      const blocks = createPeriodOrderBlocks(
        "📊 기간별 주문 내역",
        periodSummary,
        startDate!,
        endDate!,
      );

      await client.chat.postEphemeral({
        channel: (body as any).user.id,
        user: (body as any).user.id,
        text: "📊 기간별 주문 내역",
        blocks: blocks,
      });

      console.log(
        `Query modal range ${startDate}~${endDate} executed by ${body.user.id}`,
      );
    } catch (error) {
      console.error("Error handling query modal submission:", error);
      await ack({
        response_action: "errors",
        errors: {
          start_date_block: "조회 중 오류가 발생했습니다.",
        },
      });
    }
  });
}
