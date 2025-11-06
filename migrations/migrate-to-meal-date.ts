/**
 * order_date → meal_date 마이그레이션 스크립트
 *
 * 기존 order_date 컬럼을 meal_date로 변경하고 데이터를 변환합니다.
 * - 월~목 주문 → 다음날 식사
 * - 금요일 주문 → 월요일 식사 (+3일)
 *
 * 사용법:
 *   npx ts-node migrations/migrate-to-meal-date.ts
 *
 * 주의: 이 마이그레이션은 비가역적입니다. 실행 전 데이터베이스를 백업하세요.
 */

import moment from "moment-timezone";
import { pool } from "../src/storage/database";
import { ResultSetHeader, RowDataPacket } from "mysql2";

const TIMEZONE = "Asia/Seoul";

/**
 * 주문일로부터 식사일 계산
 * - 월~목: 다음날
 * - 금요일: 다음 월요일 (+3일)
 */
function calculateMealDate(orderDate: string): string {
  const orderMoment = moment.tz(orderDate, TIMEZONE);
  const dayOfWeek = orderMoment.day(); // 0(일) ~ 6(토)

  if (dayOfWeek >= 1 && dayOfWeek <= 4) {
    // 월~목: 다음 날
    return orderMoment.add(1, "day").format("YYYY-MM-DD");
  } else if (dayOfWeek === 5) {
    // 금요일: 다음 월요일 (+3일)
    return orderMoment.add(3, "days").format("YYYY-MM-DD");
  } else {
    // 토, 일: 다음 월요일 (방어 코드)
    const daysUntilMonday = dayOfWeek === 6 ? 2 : 1;
    return orderMoment.add(daysUntilMonday, "days").format("YYYY-MM-DD");
  }
}

/**
 * 데이터 마이그레이션
 */
async function migrateToMealDate(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    console.log("🚀 order_date → meal_date 마이그레이션 시작...\n");

    // 트랜잭션 시작
    await connection.beginTransaction();

    // 1. orders 테이블 마이그레이션
    console.log("📊 orders 테이블 마이그레이션 중...");

    // 기존 order_date 데이터 조회
    const [orderRows] = await connection.query<RowDataPacket[]>(
      "SELECT id, order_date FROM orders ORDER BY order_date",
    );

    if (orderRows.length > 0) {
      console.log(`   - 총 ${orderRows.length}개의 주문 발견`);

      // meal_date 컬럼 추가 (임시)
      await connection.query(`
        ALTER TABLE orders
        ADD COLUMN meal_date DATE NULL COMMENT '식사 날짜 (KST)' AFTER order_date
      `);

      // 각 행의 meal_date 계산 및 업데이트
      for (const row of orderRows) {
        const mealDate = calculateMealDate(row.order_date);
        await connection.query("UPDATE orders SET meal_date = ? WHERE id = ?", [
          mealDate,
          row.id,
        ]);
      }

      // order_date 컬럼 삭제 및 인덱스 재생성
      await connection.query(`
        ALTER TABLE orders
        DROP INDEX idx_order_date,
        DROP INDEX unique_daily_order,
        DROP COLUMN order_date
      `);

      // meal_date를 NOT NULL로 변경하고 인덱스 추가
      await connection.query(`
        ALTER TABLE orders
        MODIFY COLUMN meal_date DATE NOT NULL COMMENT '식사 날짜 (KST)',
        ADD INDEX idx_meal_date (meal_date),
        ADD UNIQUE KEY unique_daily_order (meal_date, user_id)
      `);

      console.log(
        `   ✅ orders 테이블 마이그레이션 완료 (${orderRows.length}개 행)`,
      );
    } else {
      console.log("   - 마이그레이션할 주문 데이터가 없습니다.");

      // 데이터가 없어도 스키마는 변경
      await connection.query(`
        ALTER TABLE orders
        CHANGE COLUMN order_date meal_date DATE NOT NULL COMMENT '식사 날짜 (KST)',
        DROP INDEX idx_order_date,
        DROP INDEX unique_daily_order,
        ADD INDEX idx_meal_date (meal_date),
        ADD UNIQUE KEY unique_daily_order (meal_date, user_id)
      `);

      console.log("   ✅ orders 테이블 스키마 변경 완료");
    }

    // 2. order_sessions 테이블 마이그레이션
    console.log("\n📊 order_sessions 테이블 마이그레이션 중...");

    // 기존 order_date 데이터 조회
    const [sessionRows] = await connection.query<RowDataPacket[]>(
      "SELECT order_date, closed, message_ts, message_sent, submitted, submission_id FROM order_sessions ORDER BY order_date",
    );

    if (sessionRows.length > 0) {
      console.log(`   - 총 ${sessionRows.length}개의 세션 발견`);

      // meal_date 컬럼 추가 (임시, PRIMARY KEY가 아님)
      await connection.query(`
        ALTER TABLE order_sessions
        DROP PRIMARY KEY,
        ADD COLUMN meal_date DATE NULL COMMENT '식사 날짜 (KST)' FIRST
      `);

      // 각 행의 meal_date 계산 및 업데이트
      for (const row of sessionRows) {
        const mealDate = calculateMealDate(row.order_date);
        await connection.query(
          "UPDATE order_sessions SET meal_date = ? WHERE order_date = ?",
          [mealDate, row.order_date],
        );
      }

      // order_date 컬럼 삭제
      await connection.query(`
        ALTER TABLE order_sessions
        DROP COLUMN order_date
      `);

      // meal_date를 PRIMARY KEY로 설정
      await connection.query(`
        ALTER TABLE order_sessions
        MODIFY COLUMN meal_date DATE NOT NULL COMMENT '식사 날짜 (KST)',
        ADD PRIMARY KEY (meal_date)
      `);

      console.log(
        `   ✅ order_sessions 테이블 마이그레이션 완료 (${sessionRows.length}개 행)`,
      );
    } else {
      console.log("   - 마이그레이션할 세션 데이터가 없습니다.");

      // 데이터가 없어도 스키마는 변경
      await connection.query(`
        ALTER TABLE order_sessions
        DROP PRIMARY KEY,
        CHANGE COLUMN order_date meal_date DATE NOT NULL COMMENT '식사 날짜 (KST)',
        ADD PRIMARY KEY (meal_date)
      `);

      console.log("   ✅ order_sessions 테이블 스키마 변경 완료");
    }

    // 트랜잭션 커밋
    await connection.commit();

    console.log("\n🎉 마이그레이션 완료!");
    console.log(
      "\n💡 이제 모든 날짜는 식사일 기준으로 저장됩니다 (주문일 + 1일 또는 +3일).",
    );
    console.log(
      "   애플리케이션 코드를 업데이트하여 order_date → meal_date로 변경하세요.",
    );
  } catch (error) {
    // 오류 발생 시 롤백
    await connection.rollback();
    console.error("\n❌ 마이그레이션 실패:", error);
    console.error("\n⚠️  데이터베이스가 롤백되었습니다.");
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 메인 실행
 */
async function main(): Promise<void> {
  console.log("⚠️  경고: 이 마이그레이션은 비가역적입니다!");
  console.log("   데이터베이스를 백업했는지 확인하세요.\n");
  console.log("   5초 후 시작합니다...\n");

  // 5초 대기
  await new Promise((resolve) => setTimeout(resolve, 5000));

  try {
    await migrateToMealDate();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("마이그레이션 중 오류 발생:", error);
    await pool.end();
    process.exit(1);
  }
}

main();
