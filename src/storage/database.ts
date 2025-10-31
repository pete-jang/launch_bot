import mysql from 'mysql2/promise';

/**
 * MariaDB/MySQL 연결 풀
 * - Cloudtype에서 제공하는 MariaDB 인스턴스에 연결
 * - 환경 변수를 통해 연결 정보 설정
 */
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'launch_bot',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+09:00', // KST (Korea Standard Time)
  charset: 'utf8mb4',
});

/**
 * 데이터베이스 연결 테스트
 */
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connection successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

/**
 * 데이터베이스 초기화 (테이블 생성)
 * - 앱 시작 시 한 번만 실행
 * - 테이블이 이미 존재하면 건너뜀
 */
export async function initializeDatabase(): Promise<void> {
  const connection = await pool.getConnection();

  try {
    // orders 테이블 생성
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_date DATE NOT NULL COMMENT '주문 날짜 (KST)',
        user_id VARCHAR(50) NOT NULL COMMENT 'Slack 사용자 ID',
        user_name VARCHAR(100) NOT NULL COMMENT 'Slack 사용자 이름',
        menu_type ENUM('가정식', '프레시밀') NOT NULL COMMENT '주문한 메뉴 종류',
        ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '주문 시각',
        INDEX idx_order_date (order_date),
        INDEX idx_user_id (user_id),
        UNIQUE KEY unique_daily_order (order_date, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='일일 주문 정보'
    `);

    // order_sessions 테이블 생성
    await connection.query(`
      CREATE TABLE IF NOT EXISTS order_sessions (
        order_date DATE PRIMARY KEY COMMENT '주문 날짜 (KST)',
        closed BOOLEAN DEFAULT FALSE COMMENT '주문 마감 여부',
        message_ts VARCHAR(50) NULL COMMENT 'Slack 메시지 타임스탬프 (업데이트용)',
        message_sent BOOLEAN DEFAULT FALSE COMMENT '주문 메시지 전송 여부',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '세션 생성 시각',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '마지막 업데이트 시각'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='일별 주문 세션 정보'
    `);

    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 앱 종료 시 연결 풀 정리
 */
export async function closePool(): Promise<void> {
  try {
    await pool.end();
    console.log('✅ Database connection pool closed');
  } catch (error) {
    console.error('❌ Failed to close database pool:', error);
  }
}
