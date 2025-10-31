import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from './database';
import { formatDate, getCurrentKST } from '../utils/time';

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
 * 주문 데이터 파일 읽기
 * (호환성 유지를 위해 함수는 남겨두지만, 실제로는 DB에서 모든 데이터를 가져옴)
 * @deprecated DB 기반으로 전환됨. 필요시 특정 날짜 범위로 조회하세요.
 */
export async function loadOrders(): Promise<OrdersData> {
  try {
    const [orderRows] = await pool.query<RowDataPacket[]>(
      'SELECT order_date, user_id, user_name, menu_type, ordered_at FROM orders ORDER BY order_date DESC, ordered_at ASC'
    );

    const [sessionRows] = await pool.query<RowDataPacket[]>(
      'SELECT order_date, closed, message_ts, message_sent FROM order_sessions'
    );

    const data: OrdersData = {};

    // 세션 정보 먼저 구성
    for (const session of sessionRows) {
      const dateStr = formatDate(getCurrentKST().year(session.order_date.getFullYear()).month(session.order_date.getMonth()).date(session.order_date.getDate()));
      data[dateStr] = {
        orders: [],
        closed: !!session.closed,
        messageTs: session.message_ts || undefined,
        messageSent: !!session.message_sent,
      };
    }

    // 주문 정보 추가
    for (const order of orderRows) {
      const dateStr = formatDate(getCurrentKST().year(order.order_date.getFullYear()).month(order.order_date.getMonth()).date(order.order_date.getDate()));

      if (!data[dateStr]) {
        data[dateStr] = { orders: [], closed: false };
      }

      data[dateStr].orders.push({
        userId: order.user_id,
        userName: order.user_name,
        menu: order.menu_type,
        timestamp: order.ordered_at.toISOString(),
      });
    }

    return data;
  } catch (error) {
    console.error('Failed to load orders from DB:', error);
    return {};
  }
}

/**
 * 주문 데이터 파일에 저장
 * @deprecated DB 기반으로 전환됨. 이 함수는 호환성을 위해 유지되지만 실제로는 아무 동작도 하지 않습니다.
 */
export async function saveOrders(data: OrdersData): Promise<void> {
  // DB 기반으로 전환되었으므로, 이 함수는 더 이상 사용되지 않습니다.
  // 기존 코드와의 호환성을 위해 남겨둡니다.
  console.warn('saveOrders() is deprecated. Use DB-specific functions instead.');
}

/**
 * 특정 날짜의 주문 데이터 가져오기
 */
export async function getOrdersForDate(date: string): Promise<DayOrders> {
  try {
    const [orderRows] = await pool.query<RowDataPacket[]>(
      'SELECT user_id, user_name, menu_type, ordered_at FROM orders WHERE order_date = ? ORDER BY ordered_at ASC',
      [date]
    );

    const [sessionRows] = await pool.query<RowDataPacket[]>(
      'SELECT closed, message_ts, message_sent FROM order_sessions WHERE order_date = ?',
      [date]
    );

    const session = sessionRows[0];
    const orders: Order[] = orderRows.map((row) => ({
      userId: row.user_id,
      userName: row.user_name,
      menu: row.menu_type,
      timestamp: row.ordered_at.toISOString(),
    }));

    return {
      orders,
      closed: session ? !!session.closed : false,
      messageTs: session?.message_ts || undefined,
      messageSent: session ? !!session.message_sent : false,
    };
  } catch (error) {
    console.error('Failed to get orders for date:', error);
    return { orders: [], closed: false };
  }
}

/**
 * 오늘의 주문 데이터 가져오기
 */
export async function getTodayOrders(): Promise<DayOrders> {
  const today = formatDate();
  return getOrdersForDate(today);
}

/**
 * 주문 추가
 */
export async function addOrder(userId: string, userName: string, menu: Menu): Promise<boolean> {
  const today = formatDate();

  try {
    // 세션이 마감되었는지 확인
    const [sessionRows] = await pool.query<RowDataPacket[]>(
      'SELECT closed FROM order_sessions WHERE order_date = ?',
      [today]
    );

    if (sessionRows.length > 0 && sessionRows[0].closed) {
      return false; // 이미 마감됨
    }

    const timestamp = getCurrentKST().toISOString();

    // INSERT ... ON DUPLICATE KEY UPDATE를 사용하여 주문 추가/업데이트
    await pool.query<ResultSetHeader>(
      `INSERT INTO orders (order_date, user_id, user_name, menu_type, ordered_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_name = VALUES(user_name), menu_type = VALUES(menu_type), ordered_at = VALUES(ordered_at)`,
      [today, userId, userName, menu, timestamp]
    );

    return true;
  } catch (error) {
    console.error('Failed to add order:', error);
    return false;
  }
}

/**
 * 주문 마감
 */
export async function closeOrders(date: string = formatDate()): Promise<void> {
  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO order_sessions (order_date, closed)
       VALUES (?, TRUE)
       ON DUPLICATE KEY UPDATE closed = TRUE`,
      [date]
    );
  } catch (error) {
    console.error('Failed to close orders:', error);
    throw error;
  }
}

/**
 * 주문 메시지 타임스탬프 저장
 */
export async function saveMessageTimestamp(date: string, messageTs: string): Promise<void> {
  try {
    await pool.query<ResultSetHeader>(
      `INSERT INTO order_sessions (order_date, message_ts, message_sent)
       VALUES (?, ?, TRUE)
       ON DUPLICATE KEY UPDATE message_ts = VALUES(message_ts), message_sent = TRUE`,
      [date, messageTs]
    );
  } catch (error) {
    console.error('Failed to save message timestamp:', error);
    throw error;
  }
}

/**
 * 주문 메시지가 이미 전송되었는지 확인
 */
export async function isMessageSent(date: string = formatDate()): Promise<boolean> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT message_sent FROM order_sessions WHERE order_date = ?',
      [date]
    );

    return rows.length > 0 ? !!rows[0].message_sent : false;
  } catch (error) {
    console.error('Failed to check if message sent:', error);
    return false;
  }
}

/**
 * 메뉴별 주문 수량 집계
 */
export async function getMenuSummary(date: string = formatDate()): Promise<{ [key in Menu]: number }> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT menu_type, COUNT(*) as count FROM orders WHERE order_date = ? GROUP BY menu_type',
      [date]
    );

    const summary: { [key in Menu]: number } = {
      가정식: 0,
      프레시밀: 0,
    };

    for (const row of rows) {
      summary[row.menu_type as Menu] = row.count;
    }

    return summary;
  } catch (error) {
    console.error('Failed to get menu summary:', error);
    return { 가정식: 0, 프레시밀: 0 };
  }
}

/**
 * 사용자별 주문 내역 조회
 */
export interface UserOrderSummary {
  userId: string;
  userName: string;
  menu: Menu;
}

export async function getUserOrders(date: string = formatDate()): Promise<UserOrderSummary[]> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT user_id, user_name, menu_type FROM orders WHERE order_date = ? ORDER BY ordered_at ASC',
      [date]
    );

    return rows.map((row) => ({
      userId: row.user_id,
      userName: row.user_name,
      menu: row.menu_type,
    }));
  } catch (error) {
    console.error('Failed to get user orders:', error);
    return [];
  }
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

export async function getOrdersForPeriod(startDate: string, endDate: string): Promise<PeriodOrdersSummary> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT order_date, user_id, user_name, menu_type, ordered_at FROM orders WHERE order_date BETWEEN ? AND ? ORDER BY order_date ASC, ordered_at ASC',
      [startDate, endDate]
    );

    const summary: PeriodOrdersSummary = {
      totalOrders: 0,
      totalUsers: new Set<string>(),
      menuSummary: { 가정식: 0, 프레시밀: 0 },
      userSummary: {},
      dailySummary: {},
    };

    for (const row of rows) {
      const dateStr = formatDate(getCurrentKST().year(row.order_date.getFullYear()).month(row.order_date.getMonth()).date(row.order_date.getDate()));

      // 일별 집계 초기화
      if (!summary.dailySummary[dateStr]) {
        summary.dailySummary[dateStr] = {
          orders: [],
          menuCount: { 가정식: 0, 프레시밀: 0 },
        };
      }

      const order: Order = {
        userId: row.user_id,
        userName: row.user_name,
        menu: row.menu_type,
        timestamp: row.ordered_at.toISOString(),
      };

      // 일별 집계 업데이트
      summary.dailySummary[dateStr].orders.push(order);
      summary.dailySummary[dateStr].menuCount[order.menu]++;

      // 전체 집계 업데이트
      summary.totalOrders++;
      summary.totalUsers.add(row.user_id);
      summary.menuSummary[order.menu]++;

      // 사용자별 집계 업데이트
      if (!summary.userSummary[row.user_id]) {
        summary.userSummary[row.user_id] = {
          userId: row.user_id,
          userName: row.user_name,
          count: 0,
          menuBreakdown: { 가정식: 0, 프레시밀: 0 },
        };
      }
      summary.userSummary[row.user_id].count++;
      summary.userSummary[row.user_id].menuBreakdown[order.menu]++;
    }

    return summary;
  } catch (error) {
    console.error('Failed to get orders for period:', error);
    return {
      totalOrders: 0,
      totalUsers: new Set<string>(),
      menuSummary: { 가정식: 0, 프레시밀: 0 },
      userSummary: {},
      dailySummary: {},
    };
  }
}
