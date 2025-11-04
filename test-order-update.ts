/**
 * Test order update (modify existing order)
 * Usage: npx ts-node test-order-update.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { updateOrder } from './src/automation/lunchlab';

async function main() {
  console.log('🧪 Testing order update...\n');

  // Update existing order for 2025-11-07
  const orderDate = '2025-11-07';
  const updatedMenuSummary = {
    가정식: 2,
    프레시밀: 2, // Changed from 1 to 2
  };

  console.log('Current order (before update):');
  console.log('  Date: 2025-11-07');
  console.log('  가정식: 2');
  console.log('  프레시밀: 1');
  console.log('');

  console.log('Updated order:');
  console.log(`  Date: ${orderDate}`);
  console.log(`  가정식: ${updatedMenuSummary.가정식}`);
  console.log(`  프레시밀: ${updatedMenuSummary.프레시밀} ⬆️ (increased from 1)`);
  console.log(`  Total: ${updatedMenuSummary.가정식 + updatedMenuSummary.프레시밀}\n`);

  const result = await updateOrder(orderDate, updatedMenuSummary);

  console.log('\n📊 Result:');
  console.log(`  Success: ${result.success}`);
  if (result.submissionId) {
    console.log(`  Submission ID: ${result.submissionId}`);
  }
  if (result.error) {
    console.log(`  Error: ${result.error}`);
  }
  if (result.screenshotPath) {
    console.log(`  Screenshot: ${result.screenshotPath}`);
  }

  if (result.success) {
    console.log('\n✅ Order update successful!');
    console.log('\n🔍 Please check the Lunchlab website to verify the update.');
  } else {
    console.log('\n❌ Order update failed');
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
