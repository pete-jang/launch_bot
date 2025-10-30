import { startBot, stopBot } from './bot';
import { startScheduler, stopScheduler } from './scheduler';
import { registerOrderInteraction } from './handlers/orderInteraction';
import { registerQueryCommand } from './handlers/queryCommand';
import { registerStartCommand } from './handlers/startCommand';

/**
 * 애플리케이션 시작
 */
async function main(): Promise<void> {
  try {
    console.log('🚀 Starting Lunch Order Bot...');

    // 핸들러 등록
    console.log('📝 Registering handlers...');
    registerOrderInteraction();
    registerQueryCommand();
    registerStartCommand();

    // Bot 시작
    await startBot();

    // 스케줄러 시작
    startScheduler();

    console.log('✅ Lunch Order Bot is ready!');
    console.log('---');
    console.log('Features:');
    console.log('- Daily order message at 12:00 PM (Mon-Fri)');
    console.log('- Automatic order close at 2:00 PM (Mon-Fri)');
    console.log('- /주문시작 command to manually start orders');
    console.log('- /주문내역 command to view order summary');
    console.log('---');
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
}

/**
 * 애플리케이션 종료 처리
 */
function setupGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    try {
      stopScheduler();
      await stopBot();
      console.log('✅ Shutdown complete');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// 애플리케이션 시작
setupGracefulShutdown();
main();
