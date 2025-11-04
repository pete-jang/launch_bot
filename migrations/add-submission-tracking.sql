-- Add submission tracking fields to order_sessions table

ALTER TABLE order_sessions
ADD COLUMN submitted BOOLEAN DEFAULT FALSE COMMENT 'Lunchlab 제출 완료 여부' AFTER message_sent,
ADD COLUMN submission_id VARCHAR(100) NULL COMMENT 'Lunchlab 주문 ID (수정용)' AFTER submitted;
