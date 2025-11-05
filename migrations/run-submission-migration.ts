/**
 * Run database migration to add submission tracking fields
 * Usage: npx ts-node migrations/run-submission-migration.ts
 */

import dotenv from "dotenv";
dotenv.config();

import { pool } from "../src/storage/database";

async function runMigration() {
  try {
    console.log("Running submission tracking migration...");

    // Check if columns already exist
    const [columns] = await pool.query(
      `SHOW COLUMNS FROM order_sessions WHERE Field IN ('submitted', 'submission_id')`,
    );

    if (Array.isArray(columns) && columns.length > 0) {
      console.log("Columns already exist. Migration skipped.");
      process.exit(0);
    }

    // Add columns
    await pool.query(`
      ALTER TABLE order_sessions
      ADD COLUMN submitted BOOLEAN DEFAULT FALSE COMMENT 'Lunchlab 제출 완료 여부' AFTER message_sent,
      ADD COLUMN submission_id VARCHAR(100) NULL COMMENT 'Lunchlab 주문 ID (수정용)' AFTER submitted
    `);

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();
