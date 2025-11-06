-- Add meal_date column to orders and order_sessions tables
-- This migration adds meal_date alongside existing order_date for dual-write strategy

-- Add meal_date column to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS meal_date DATE NULL COMMENT '식사 날짜 (KST)' AFTER order_date;

-- Add index on meal_date for efficient queries
CREATE INDEX IF NOT EXISTS idx_meal_date ON orders(meal_date);

-- Add meal_date column to order_sessions table
ALTER TABLE order_sessions
ADD COLUMN IF NOT EXISTS meal_date DATE NULL COMMENT '식사 날짜 (KST)' AFTER order_date;

-- Add index on meal_date for efficient queries
CREATE INDEX IF NOT EXISTS idx_meal_date_session ON order_sessions(meal_date);

-- Backfill meal_date for existing records
-- Friday orders (day 6) → Monday meals (+3 days)
-- Mon-Thu orders (days 2-5) → next day meals (+1 day)
UPDATE orders
SET meal_date = DATE_ADD(order_date, INTERVAL
  CASE DAYOFWEEK(order_date)
    WHEN 6 THEN 3  -- Friday: +3 days to Monday
    ELSE 1         -- Mon-Thu: +1 day
  END DAY)
WHERE meal_date IS NULL;

UPDATE order_sessions
SET meal_date = DATE_ADD(order_date, INTERVAL
  CASE DAYOFWEEK(order_date)
    WHEN 6 THEN 3  -- Friday: +3 days to Monday
    ELSE 1         -- Mon-Thu: +1 day
  END DAY)
WHERE meal_date IS NULL;
