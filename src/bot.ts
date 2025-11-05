import { App } from "@slack/bolt";
import dotenv from "dotenv";

dotenv.config();

// 환경 변수 검증
const requiredEnvVars = [
  "SLACK_BOT_TOKEN",
  "SLACK_APP_TOKEN",
  "SLACK_SIGNING_SECRET",
  "SLACK_CHANNEL_ID",
];
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
  logLevel: (process.env.LOG_LEVEL as any) || "info",
});

/**
 * 채널 ID 가져오기
 */
export function getChannelId(): string {
  return process.env.SLACK_CHANNEL_ID!;
}

/**
 * 허용된 채널인지 확인
 */
export function isAllowedChannel(channelId: string): boolean {
  const allowedChannelId = process.env.SLACK_CHANNEL_ID;
  return channelId === allowedChannelId;
}

/**
 * 관리자 사용자인지 확인
 */
export function isAdminUser(userId: string): boolean {
  const adminIds = process.env.SLACK_ADMIN_IDS;
  if (!adminIds) {
    return false;
  }
  const adminIdList = adminIds.split(",").map((id) => id.trim());
  return adminIdList.includes(userId);
}

/**
 * Bot 시작
 */
export async function startBot(): Promise<void> {
  await app.start();
  console.log("⚡️ Lunch Order Bot is running!");
}

/**
 * Bot 종료
 */
export async function stopBot(): Promise<void> {
  await app.stop();
  console.log("👋 Lunch Order Bot stopped");
}
