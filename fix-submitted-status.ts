/**
 * Fix submitted status for a specific date
 */
import dotenv from 'dotenv';
dotenv.config();

import { markOrderAsSubmitted } from './src/storage/orders';
import { initializeDatabase, closePool } from './src/storage/database';

async function fixSubmittedStatus() {
  try {
    await initializeDatabase();

    const orderDate = '2025-11-05';
    console.log(`Marking ${orderDate} as submitted in database...`);

    await markOrderAsSubmitted(orderDate, orderDate); // Use orderDate as submissionId

    console.log(`✅ Successfully marked ${orderDate} as submitted`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await closePool();
  }
}

fixSubmittedStatus();
