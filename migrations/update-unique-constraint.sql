-- Update unique constraint from order_date to meal_date
-- This migration changes the logical constraint to enforce one order per meal date per user

-- Step 1: Drop old constraint (order_date based)
ALTER TABLE orders DROP INDEX IF EXISTS unique_daily_order;

-- Step 2: Add new constraint (meal_date based)
ALTER TABLE orders ADD UNIQUE KEY IF NOT EXISTS unique_daily_meal_order (meal_date, user_id);
