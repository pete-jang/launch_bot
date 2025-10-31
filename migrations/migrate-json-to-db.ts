/**
 * JSON → MariaDB 마이그레이션 스크립트
 *
 * 기존 data/orders.json 파일의 데이터를 MariaDB로 이동합니다.
 *
 * 사용법:
 *   npx ts-node migrations/migrate-json-to-db.ts
 */

import fs from 'fs';
import path from 'path';
import { pool } from '../src/storage/database';
import { ResultSetHeader } from 'mysql2';

interface Order {
  userId: string;
  userName: string;
  menu: '가정식' | '프레시밀';
  timestamp: string;
}

interface DayOrders {
  orders: Order[];
  closed: boolean;
  messageTs?: string;
  messageSent?: boolean;
}

interface OrdersData {
  [date: string]: DayOrders;
}

/**
 * JSON 파일 읽기
 */
function loadJsonFile(): OrdersData {
  const jsonPath = path.join(__dirname, '../data/orders.json');

  if (!fs.existsSync(jsonPath)) {
    console.log('⚠️  data/orders.json 파일이 없습니다. 마이그레이션할 데이터가 없습니다.');
    return {};
  }

  try {
    const data = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ JSON 파일 읽기 실패:', error);
    throw error;
  }
}

/**
 * 데이터 마이그레이션
 */
async function migrateData(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    console.log('🚀 JSON → DB 마이그레이션 시작...\n');

    // JSON 파일 로드
    const ordersData = loadJsonFile();
    const dates = Object.keys(ordersData).sort();

    if (dates.length === 0) {
      console.log('✅ 마이그레이션할 데이터가 없습니다.');
      return;
    }

    console.log(`📊 총 ${dates.length}일의 데이터를 발견했습니다.\n`);

    let totalOrders = 0;
    let totalSessions = 0;

    // 트랜잭션 시작
    await connection.beginTransaction();

    for (const date of dates) {
      const dayData = ordersData[date];

      // order_sessions 테이블에 삽입
      await connection.query<ResultSetHeader>(
        `INSERT INTO order_sessions (order_date, closed, message_ts, message_sent)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE closed = VALUES(closed), message_ts = VALUES(message_ts), message_sent = VALUES(message_sent)`,
        [date, dayData.closed, dayData.messageTs || null, dayData.messageSent || false]
      );
      totalSessions++;

      // orders 테이블에 삽입
      for (const order of dayData.orders) {
        await connection.query<ResultSetHeader>(
          `INSERT INTO orders (order_date, user_id, user_name, menu_type, ordered_at)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE user_name = VALUES(user_name), menu_type = VALUES(menu_type), ordered_at = VALUES(ordered_at)`,
          [date, order.userId, order.userName, order.menu, order.timestamp]
        );
        totalOrders++;
      }

      console.log(`✅ ${date}: ${dayData.orders.length}개 주문 마이그레이션 완료`);
    }

    // 트랜잭션 커밋
    await connection.commit();

    console.log('\n🎉 마이그레이션 완료!');
    console.log(`   - 총 ${totalSessions}개의 세션`);
    console.log(`   - 총 ${totalOrders}개의 주문`);
    console.log('\n💡 원본 data/orders.json 파일은 백업 후 삭제하거나 data/orders.json.backup으로 이름을 변경하세요.');

  } catch (error) {
    // 오류 발생 시 롤백
    await connection.rollback();
    console.error('\n❌ 마이그레이션 실패:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 메인 실행
 */
async function main(): Promise<void> {
  try {
    await migrateData();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('마이그레이션 중 오류 발생:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
