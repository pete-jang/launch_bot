import fs from 'fs';
import path from 'path';
import { formatDate, getCurrentKST } from '../utils/time';

const DATA_DIR = path.join(__dirname, '../../data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

export type Menu = '가정식' | '프레시밀';

export interface Order {
  userId: string;
  userName: string;
  menu: Menu;
  timestamp: string;
}

export interface DayOrders {
  orders: Order[];
  closed: boolean;
  messageTs?: string; // 주문 메시지의 타임스탬프 (업데이트용)
  messageSent?: boolean; // 주문 메시지가 전송되었는지 여부 (수동/자동 모두 포함)
}

export interface OrdersData {
  [date: string]: DayOrders;
}

/**
 * 데이터 디렉토리 초기화
 */
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * 주문 데이터 파일 읽기
 */
export function loadOrders(): OrdersData {
  ensureDataDir();

  if (!fs.existsSync(ORDERS_FILE)) {
    return {};
  }

  try {
    const data = fs.readFileSync(ORDERS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load orders:', error);
    return {};
  }
}

/**
 * 주문 데이터 파일에 저장
 */
export function saveOrders(data: OrdersData): void {
  ensureDataDir();

  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save orders:', error);
    throw error;
  }
}

/**
 * 특정 날짜의 주문 데이터 가져오기
 */
export function getOrdersForDate(date: string): DayOrders {
  const allOrders = loadOrders();
  return allOrders[date] || { orders: [], closed: false };
}

/**
 * 오늘의 주문 데이터 가져오기
 */
export function getTodayOrders(): DayOrders {
  const today = formatDate();
  return getOrdersForDate(today);
}

/**
 * 주문 추가
 */
export function addOrder(userId: string, userName: string, menu: Menu): boolean {
  const today = formatDate();
  const allOrders = loadOrders();

  if (!allOrders[today]) {
    allOrders[today] = { orders: [], closed: false };
  }

  // 이미 마감된 경우
  if (allOrders[today].closed) {
    return false;
  }

  // 기존 주문 찾기
  const existingOrderIndex = allOrders[today].orders.findIndex(
    (order) => order.userId === userId
  );

  const timestamp = getCurrentKST().toISOString();

  if (existingOrderIndex >= 0) {
    // 기존 주문 업데이트
    allOrders[today].orders[existingOrderIndex] = {
      userId,
      userName,
      menu,
      timestamp,
    };
  } else {
    // 새 주문 추가
    allOrders[today].orders.push({
      userId,
      userName,
      menu,
      timestamp,
    });
  }

  saveOrders(allOrders);
  return true;
}

/**
 * 주문 마감
 */
export function closeOrders(date: string = formatDate()): void {
  const allOrders = loadOrders();

  if (!allOrders[date]) {
    allOrders[date] = { orders: [], closed: true };
  } else {
    allOrders[date].closed = true;
  }

  saveOrders(allOrders);
}

/**
 * 주문 메시지 타임스탬프 저장
 */
export function saveMessageTimestamp(date: string, messageTs: string): void {
  const allOrders = loadOrders();

  if (!allOrders[date]) {
    allOrders[date] = { orders: [], closed: false };
  }

  allOrders[date].messageTs = messageTs;
  allOrders[date].messageSent = true;
  saveOrders(allOrders);
}

/**
 * 주문 메시지가 이미 전송되었는지 확인
 */
export function isMessageSent(date: string = formatDate()): boolean {
  const allOrders = loadOrders();
  return allOrders[date]?.messageSent ?? false;
}

/**
 * 메뉴별 주문 수량 집계
 */
export function getMenuSummary(date: string = formatDate()): { [key in Menu]: number } {
  const dayOrders = getOrdersForDate(date);
  const summary: { [key in Menu]: number } = {
    가정식: 0,
    프레시밀: 0,
  };

  dayOrders.orders.forEach((order) => {
    summary[order.menu]++;
  });

  return summary;
}

/**
 * 사용자별 주문 내역 조회
 */
export interface UserOrderSummary {
  userId: string;
  userName: string;
  menu: Menu;
}

export function getUserOrders(date: string = formatDate()): UserOrderSummary[] {
  const dayOrders = getOrdersForDate(date);

  return dayOrders.orders.map((order) => ({
    userId: order.userId,
    userName: order.userName,
    menu: order.menu,
  }));
}

/**
 * 기간별 주문 내역 조회
 */
export interface UserOrderCount {
  userId: string;
  userName: string;
  count: number;
  menuBreakdown: { [key in Menu]: number };
}

export interface PeriodOrdersSummary {
  totalOrders: number;
  totalUsers: Set<string>;
  menuSummary: { [key in Menu]: number };
  userSummary: { [userId: string]: UserOrderCount };
  dailySummary: {
    [date: string]: {
      orders: Order[];
      menuCount: { [key in Menu]: number };
    };
  };
}

export function getOrdersForPeriod(startDate: string, endDate: string): PeriodOrdersSummary {
  const allOrders = loadOrders();
  const summary: PeriodOrdersSummary = {
    totalOrders: 0,
    totalUsers: new Set<string>(),
    menuSummary: { 가정식: 0, 프레시밀: 0 },
    userSummary: {},
    dailySummary: {},
  };

  // 날짜 범위 생성
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = formatDate(getCurrentKST().year(date.getFullYear()).month(date.getMonth()).date(date.getDate()));
    const dayOrders = allOrders[dateStr];

    if (dayOrders && dayOrders.orders.length > 0) {
      summary.dailySummary[dateStr] = {
        orders: dayOrders.orders,
        menuCount: { 가정식: 0, 프레시밀: 0 },
      };

      dayOrders.orders.forEach((order) => {
        summary.totalOrders++;
        summary.totalUsers.add(order.userId);
        summary.menuSummary[order.menu]++;
        summary.dailySummary[dateStr].menuCount[order.menu]++;

        // 사용자별 주문 집계
        if (!summary.userSummary[order.userId]) {
          summary.userSummary[order.userId] = {
            userId: order.userId,
            userName: order.userName,
            count: 0,
            menuBreakdown: { 가정식: 0, 프레시밀: 0 },
          };
        }
        summary.userSummary[order.userId].count++;
        summary.userSummary[order.userId].menuBreakdown[order.menu]++;
      });
    }
  }

  return summary;
}
