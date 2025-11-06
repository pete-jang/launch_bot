-- 런치봇 데이터베이스 초기 스키마

-- orders 테이블: 개별 주문 정보 저장
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_date DATE NOT NULL COMMENT '주문 날짜 (KST)',
  user_id VARCHAR(50) NOT NULL COMMENT 'Slack 사용자 ID',
  user_name VARCHAR(100) NOT NULL COMMENT 'Slack 사용자 이름',
  menu_type ENUM('가정식', '프레시밀') NOT NULL COMMENT '주문한 메뉴 종류',
  ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '주문 시각',

  -- 인덱스
  INDEX idx_order_date (order_date),
  INDEX idx_user_id (user_id),

  -- 동일한 날짜에 같은 사용자가 중복 주문하지 못하도록 제약
  UNIQUE KEY unique_daily_order (order_date, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='일일 주문 정보';

-- order_sessions 테이블: 일별 주문 세션 정보 (마감 여부, 메시지 타임스탬프 등)
CREATE TABLE IF NOT EXISTS order_sessions (
  order_date DATE PRIMARY KEY COMMENT '주문 날짜 (KST)',
  closed BOOLEAN DEFAULT FALSE COMMENT '주문 마감 여부',
  message_ts VARCHAR(50) NULL COMMENT 'Slack 메시지 타임스탬프 (업데이트용)',
  message_sent BOOLEAN DEFAULT FALSE COMMENT '주문 메시지 전송 여부',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '세션 생성 시각',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '마지막 업데이트 시각'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='일별 주문 세션 정보';
