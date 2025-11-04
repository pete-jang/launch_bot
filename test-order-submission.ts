/**
 * Test order submission
 * Usage: npx ts-node test-order-submission.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { submitOrder } from './src/automation/lunchlab';

async function main() {
  console.log('🧪 Testing order submission...\n');

  // Test with sample order
  const orderDate = '2025-11-07';
  const menuSummary = {
    가정식: 2,
    프레시밀: 1,
  };

  console.log('Test order:');
  console.log(`  Date: ${orderDate}`);
  console.log(`  가정식: ${menuSummary.가정식}`);
  console.log(`  프레시밀: ${menuSummary.프레시밀}`);
  console.log(`  Total: ${menuSummary.가정식 + menuSummary.프레시밀}\n`);

  const result = await submitOrder(orderDate, menuSummary);

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
    console.log('\n✅ Order submission successful!');
  } else {
    console.log('\n❌ Order submission failed');
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
