import { App } from '@slack/bolt';
import dotenv from 'dotenv';

dotenv.config();

// 환경 변수 검증
const requiredEnvVars = ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_CHANNEL_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

/**
 * Slack Bot App 초기화
 */
export const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true, // Socket Mode 사용
  logLevel: process.env.LOG_LEVEL as any || 'info',
});

/**
 * 채널 ID 가져오기
 */
export function getChannelId(): string {
  return process.env.SLACK_CHANNEL_ID!;
}

/**
 * Bot 시작
 */
export async function startBot(): Promise<void> {
  await app.start();
  console.log('⚡️ Lunch Order Bot is running!');
}

/**
 * Bot 종료
 */
export async function stopBot(): Promise<void> {
  await app.stop();
  console.log('👋 Lunch Order Bot stopped');
}
