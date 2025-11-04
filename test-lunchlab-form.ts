/**
 * Test script to inspect Lunchlab order form
 * Usage: npx ts-node test-lunchlab-form.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { inspectForm } from './src/automation/lunchlab';

async function main() {
  console.log('Starting Lunchlab form inspection...');
  console.log('Environment variables:');
  console.log('  LUNCHLAB_USERNAME:', process.env.LUNCHLAB_USERNAME);
  console.log('  LUNCHLAB_PASSWORD:', process.env.LUNCHLAB_PASSWORD ? '***' : 'NOT SET');
  console.log('  LUNCHLAB_BASE_URL:', process.env.LUNCHLAB_BASE_URL);
  console.log('  SCREENSHOTS_DIR:', process.env.SCREENSHOTS_DIR);
  console.log('');

  // Test with 2025-11-07 (as mentioned by user)
  const testDate = '2025-11-07';

  console.log(`Inspecting form for date: ${testDate}`);
  console.log('\n⚠️  Browser window will open - watch the automation process\n');
  await inspectForm(testDate, true, false); // Force fresh login, headless = false

  console.log('\nForm inspection complete!');
  console.log('Check the screenshots directory for:');
  console.log('  - form-inspect-2025-11-07.png');
  console.log('  - form-structure-2025-11-07.html');
}

main()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
