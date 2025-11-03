import moment from 'moment-timezone';

const TIMEZONE = 'Asia/Seoul';

/**
 * 현재 한국 시간을 반환
 */
export function getCurrentKST(): moment.Moment {
  return moment.tz(TIMEZONE);
}

/**
 * 날짜를 'YYYY-MM-DD' 형식 문자열로 변환
 */
export function formatDate(date: moment.Moment = getCurrentKST()): string {
  return date.format('YYYY-MM-DD');
}

/**
 * 날짜를 'YYYY-MM-DD HH:mm:ss' 형식 문자열로 변환
 */
export function formatDateTime(date: moment.Moment = getCurrentKST()): string {
  return date.format('YYYY-MM-DD HH:mm:ss');
}

/**
 * 평일인지 확인 (월~금)
 * @param date 확인할 날짜 (기본값: 현재 날짜)
 */
export function isWeekday(date: moment.Moment = getCurrentKST()): boolean {
  const dayOfWeek = date.day(); // 0(일요일) ~ 6(토요일)
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

/**
 * 오늘이 평일인지 확인
 */
export function isTodayWeekday(): boolean {
  return isWeekday(getCurrentKST());
}

/**
 * ISO 문자열을 한국 시간 Moment 객체로 변환
 */
export function parseToKST(isoString: string): moment.Moment {
  return moment.tz(isoString, TIMEZONE);
}

/**
 * 현재 시간이 주문 가능 시간인지 확인
 * 평일 12시부터 14시까지
 */
export function isOrderingTime(): boolean {
  if (!isTodayWeekday()) {
    return false;
  }

  const now = getCurrentKST();
  const hour = now.hour();

  return hour >= 12 && hour < 14;
}

/**
 * 주문 마감 여부 확인
 * 평일 14시 이후
 */
export function isAfterOrderDeadline(): boolean {
  if (!isTodayWeekday()) {
    return true; // 주말은 항상 마감
  }

  const now = getCurrentKST();
  const hour = now.hour();

  return hour >= 14;
}

/**
 * 주문일로부터 다음 평일(식사일) 계산
 * 월~목: 다음날 (화~금)
 * 금요일: 다음 월요일 (+3일)
 */
export function getNextWeekday(date: moment.Moment): moment.Moment {
  const dayOfWeek = date.day(); // 0(일) ~ 6(토)

  if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    // 월~목: 다음 날
    return date.clone().add(1, 'day');
  } else if (dayOfWeek === 5) {
    // 금요일: 다음 월요일 (+3일)
    return date.clone().add(3, 'days');
  } else {
    // 토, 일: 다음 월요일 (이론상 주문 불가능하지만 방어 코드)
    const daysUntilMonday = dayOfWeek === 6 ? 2 : 1;
    return date.clone().add(daysUntilMonday, 'days');
  }
}

/**
 * 주문일을 식사일로 변환
 */
export function getMealDateFromOrderDate(orderDate: string): string {
  const orderMoment = moment.tz(orderDate, TIMEZONE);
  const mealMoment = getNextWeekday(orderMoment);
  return formatDate(mealMoment);
}

/**
 * 이번 주의 시작일과 종료일 반환 (월요일 ~ 일요일)
 */
export function getThisWeekRange(): { start: string; end: string } {
  const now = getCurrentKST();
  const startOfWeek = now.clone().startOf('week'); // 일요일
  const endOfWeek = now.clone().endOf('week'); // 토요일

  return {
    start: formatDate(startOfWeek),
    end: formatDate(endOfWeek),
  };
}

/**
 * 이번 달의 시작일과 종료일 반환 (식사일 기준)
 * 이번 달에 먹을 식사들의 주문일 범위를 반환
 * 예: 11월 식사(11/3~11/28) → 주문일(10/31~11/27)
 */
export function getThisMonthRange(): { start: string; end: string } {
  const now = getCurrentKST();
  const startOfMonth = now.clone().startOf('month');
  const endOfMonth = now.clone().endOf('month');

  // 이번 달의 첫 평일 찾기 (첫 식사일)
  let firstMealDate = startOfMonth.clone();
  while (!isWeekday(firstMealDate)) {
    firstMealDate.add(1, 'day');
  }

  // 이번 달의 마지막 평일 찾기 (마지막 식사일)
  let lastMealDate = endOfMonth.clone();
  while (!isWeekday(lastMealDate)) {
    lastMealDate.subtract(1, 'day');
  }

  // 식사일의 전날이 주문일
  // 첫 식사일의 주문일 계산
  const firstOrderDate = firstMealDate.clone();
  const firstDayOfWeek = firstMealDate.day();
  if (firstDayOfWeek === 1) {
    // 월요일 식사 → 전주 금요일 주문 (-3일)
    firstOrderDate.subtract(3, 'days');
  } else {
    // 화~금 식사 → 전날 주문 (-1일)
    firstOrderDate.subtract(1, 'day');
  }

  // 마지막 식사일의 주문일 계산
  const lastOrderDate = lastMealDate.clone();
  const lastDayOfWeek = lastMealDate.day();
  if (lastDayOfWeek === 1) {
    // 월요일 식사 → 전주 금요일 주문 (-3일)
    lastOrderDate.subtract(3, 'days');
  } else {
    // 화~금 식사 → 전날 주문 (-1일)
    lastOrderDate.subtract(1, 'day');
  }

  return {
    start: formatDate(firstOrderDate),
    end: formatDate(lastOrderDate),
  };
}

/**
 * 날짜 문자열이 유효한지 확인
 */
export function isValidDate(dateString: string): boolean {
  return moment(dateString, 'YYYY-MM-DD', true).isValid();
}

/**
 * 날짜 범위 문자열 파싱 (예: "2025-10-01~2025-10-31")
 * @returns { start, end } 또는 null (유효하지 않은 경우)
 */
export function parseDateRange(rangeString: string): { start: string; end: string } | null {
  const parts = rangeString.split('~');
  if (parts.length !== 2) {
    return null;
  }

  const start = parts[0].trim();
  const end = parts[1].trim();

  if (!isValidDate(start) || !isValidDate(end)) {
    return null;
  }

  // 시작 날짜가 종료 날짜보다 뒤인 경우
  if (moment(start).isAfter(moment(end))) {
    return null;
  }

  return { start, end };
}
