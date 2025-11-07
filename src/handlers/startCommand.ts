import { app, isAllowedChannel } from "../bot";
import { sendOrderMessage } from "./orderMessage";
import { isMessageSent } from "../storage/orders";
import {
  formatDate,
  isValidDate,
  isWeekdayDate,
  isPastDate,
  formatDateWithDay,
  getMealDateFromOrderDate,
} from "../utils/time";

/**
 * 주문 시작 슬래시 커맨드 등록
 * 사용법: /주문시작 [주문날짜]
 * 예: /주문시작 또는 /주문시작 2025-11-07
 * 날짜는 주문일(order_date)을 의미하며, 다음 평일의 식사를 위한 주문을 시작합니다.
 */
export function registerStartCommand(): void {
  app.command("/주문시작", async ({ command, ack, respond }) => {
    await ack();

    try {
      // 채널 확인
      if (!isAllowedChannel(command.channel_id)) {
        await respond({
          text: "지정된 채널에서만 주문 시작이 가능합니다.",
          response_type: "ephemeral",
        });
        return;
      }

      // 날짜 파라미터 파싱 (없으면 오늘)
      const dateParam = command.text.trim();
      let orderDate: string;

      if (!dateParam) {
        // 파라미터가 없으면 오늘
        orderDate = formatDate();
      } else {
        // 날짜 형식 검증
        if (!isValidDate(dateParam)) {
          await respond({
            text: "날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.\n예: /주문시작 2025-11-07",
            response_type: "ephemeral",
          });
          return;
        }

        orderDate = dateParam;
      }

      // 과거 날짜 체크
      if (isPastDate(orderDate)) {
        await respond({
          text: "과거 날짜에 대한 주문은 생성할 수 없습니다.",
          response_type: "ephemeral",
        });
        return;
      }

      // 평일 체크 (주문일이 평일이어야 함)
      if (!isWeekdayDate(orderDate)) {
        await respond({
          text: "주문은 평일(월~금)에만 받을 수 있습니다.",
          response_type: "ephemeral",
        });
        return;
      }

      // 주문일로부터 식사일 계산
      const mealDate = getMealDateFromOrderDate(orderDate);

      // 이미 주문 메시지가 전송되었는지 확인 (식사일 기준)
      if (await isMessageSent(mealDate)) {
        await respond({
          text: `${formatDateWithDay(orderDate)} 주문 메시지가 이미 전송되었습니다. (${formatDateWithDay(mealDate)} 식사)`,
          response_type: "ephemeral",
        });
        return;
      }

      // 주문 메시지 전송 (식사일로 전송)
      await sendOrderMessage(mealDate);

      await respond({
        text: `${formatDateWithDay(orderDate)} 주문 메시지가 전송되었습니다. (${formatDateWithDay(mealDate)} 식사)`,
        response_type: "ephemeral",
      });

      console.log(
        `Manual order started by ${command.user_id} for order_date=${orderDate}, meal_date=${mealDate}`,
      );
    } catch (error) {
      console.error("Error handling start command:", error);
      await respond({
        text: "오류가 발생했습니다.",
        response_type: "ephemeral",
      });
    }
  });
}
