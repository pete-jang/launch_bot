/**
 * Test API client
 */

import dotenv from 'dotenv';
dotenv.config();

import { submitOrder } from './src/automation/lunchlab-api';

async function testAPI() {
  console.log('🧪 Testing API client...\n');

  // Test with a future date
  const testDate = '2025-11-25';
  const menuSummary = {
    가정식: 2,
    프레시밀: 1,
  };

  console.log(`Testing order submission for ${testDate}:`);
  console.log('Menu:', menuSummary);
  console.log('');

  try {
    const result = await submitOrder(testDate, menuSummary);

    if (result.success) {
      console.log('✅ Order submitted successfully!');
      console.log('Submission ID:', result.submissionId);
    } else {
      console.log('❌ Order submission failed');
      console.log('Error:', result.error);
    }
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

testAPI()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  });
