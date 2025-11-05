# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Slack bot for daily lunch ordering that:

- Automatically posts order messages at noon on weekdays
- Closes orders at 2 PM
- Automatically submits orders to Lunchlab when minimum quantity (3) is met
- Supports order updates after submission
- Uses Socket Mode (no webhooks) and stores data in MariaDB database

## Development Policy

**Code Quality Standards**:

- ALWAYS run `npm run build` after making ANY code changes to ensure TypeScript compilation succeeds
- ALWAYS run `npx prettier --write .` after making changes to maintain consistent code formatting
- Fix any compilation errors or type issues before committing

**Automatic Git Commits and Pushes**:

- Commit and push changes immediately after completing any task or making meaningful changes
- Use descriptive commit messages that explain what was changed and why
- This ensures changes are backed up and deployed automatically via GitHub Actions

**File Management**:

- Never commit test or analysis scripts (test-_.ts, analyze-_.ts, check-\*.ts, etc.)
- Keep only production code in the repository

## Essential Commands

### Development

```bash
npm run dev        # Run with ts-node (development)
npm run build      # Compile TypeScript
npm start          # Run compiled code (production)
npm run watch      # Watch mode for TypeScript compilation
```

### Testing the Bot Locally

1. Ensure `.env` is configured with valid Slack tokens and Lunchlab credentials
2. Run `npm run dev`
3. Test in Slack:
   - `/주문시작` - Manually trigger order message
   - `/주문내역` - View order history (supports: 오늘, 이번주, 이번달, YYYY-MM-DD, YYYY-MM-DD~YYYY-MM-DD)
   - `/식사도착` - Send meal arrival notification
   - `/주문상태조회 [날짜]` - Check Lunchlab submission status (admin only)
   - `/주문상태수정 <날짜> submitted` - Manually mark order as submitted (admin only)
   - Click menu buttons (🍚 가정식, 🥗 프레시밀) to place orders
   - Open App Home tab to view order history and access admin features (if admin)

## Architecture

### Application Flow

1. **Startup** (`index.ts`):
   - Registers handlers → Starts bot → Initializes scheduler
   - Handlers are registered BEFORE bot starts (critical order)

2. **Handler Registration Pattern**:
   - `registerOrderInteraction()`: Button click handlers for menu selection (triggers auto-submission if minimum met)
   - `registerQueryCommand()`: Slash command + button handlers for order queries
   - `registerStartCommand()`: Manual order start command
   - `registerDeliveryCommand()`: Meal arrival notification command
   - `registerAdminCommand()`: Admin commands for order status management
   - `registerAppHome()`: App Home tab with order history and admin delete functionality
   - All handlers use `app.action()`, `app.command()`, registered in handler files

3. **Scheduler** (`scheduler.ts`):
   - Uses `node-schedule` with cron patterns
   - `0 12 * * 1-5`: Daily order message at noon (Mon-Fri)
   - `0 14 * * 1-5`: Auto-close orders at 2 PM (Mon-Fri)
   - Checks `isMessageSent()` to prevent duplicate messages if manual start was used

4. **Data Storage** (`storage/orders.ts` + `storage/database.ts`):
   - MariaDB/MySQL database with two tables:
     - `orders`: Individual order records (order_date, user_id, user_name, menu_type, ordered_at)
     - `order_sessions`: Daily session info (order_date, closed, message_ts, message_sent, submitted, submission_id, meal_date)
   - All functions are async and use connection pooling
   - Connection pool initialized on startup (`initializeDatabase()`)
   - User can change their order multiple times before closing (using ON DUPLICATE KEY UPDATE)
   - Tracks Lunchlab submission status and order ID for updates

5. **Lunchlab Integration** (`automation/` directory):
   - `lunchlab-api.ts`: API client for Lunchlab order submission
   - `submitter.ts`: Orchestration layer that handles automatic submission when minimum order count (3) is reached
   - `lunchlab.ts`: Cookie-based authentication and session management
   - Automatically submits orders to Lunchlab when 3+ orders are placed
   - Supports updating already-submitted orders
   - Uses retry logic (3 attempts, 5 min delay) for robustness
   - Notifies channel on success/failure (mentions admins on failure)

6. **Message Updates** (`handlers/orderMessage.ts`):
   - When order button clicked → updates message with current order count → checks for auto-submission
   - Uses saved `messageTs` to update the original message
   - At 2 PM → sends closed message (updates original or posts new)

### Critical Implementation Details

**Timezone Handling**:

- All time operations use `moment-timezone` with `Asia/Seoul`
- `getCurrentKST()` returns moment object in KST
- `formatDate()` returns YYYY-MM-DD in KST
- Environment variable `TZ=Asia/Seoul` should be set

**Message Tone**:

- All user-facing messages use a clean, professional tone
- Messages are clear and informative
- Examples: "주문 마감 시간(2시)이 지났습니다.", "주문이 완료되었습니다."

**Order State Management**:

- `closed: false` → accepting orders
- `closed: true` → orders locked
- `messageSent: true` → prevents duplicate auto-messages
- `submitted: false/true` → tracks if order was submitted to Lunchlab
- `submission_id` → stores Lunchlab order ID for future updates
- Users can update their order before closing (replaces existing order)
- After closing, orders can still be updated in Lunchlab if minimum count is maintained

**Lunchlab Automation**:

- Minimum order count: 3 orders required for submission
- Auto-submission triggers when 3rd order is placed
- Cookie-based authentication (cookies loaded from file or env var)
- Meal date calculation: order placed today is for tomorrow's lunch
- Retries: 3 attempts with 5-minute delays between attempts
- Notifications: Success message to channel, failure message with admin mentions

**Socket Mode**:

- Uses `socketMode: true` in Bolt config
- Requires `SLACK_APP_TOKEN` (xapp-...) and `SLACK_BOT_TOKEN` (xoxb-...)
- No webhook URLs needed

### File Responsibilities

**Core**:

- `index.ts`: Application entry point, handler registration, graceful shutdown
- `bot.ts`: Slack App initialization, exports `app` instance and helpers (`isAdminUser()`, `isAllowedChannel()`)
- `scheduler.ts`: Cron jobs for auto-messages (12 PM) and auto-close (2 PM)

**Handlers**:

- `handlers/orderMessage.ts`: Creates/updates order messages, sends closed message
- `handlers/orderInteraction.ts`: Handles button clicks (order*가정식, order*프레시밀), triggers auto-submission
- `handlers/queryCommand.ts`: `/주문내역` command with period filtering logic
- `handlers/startCommand.ts`: `/주문시작` manual trigger with validation
- `handlers/deliveryCommand.ts`: `/식사도착` meal arrival notification
- `handlers/adminCommand.ts`: `/주문상태조회` and `/주문상태수정` admin commands
- `handlers/appHome.ts`: App Home tab UI and admin delete functionality

**Storage**:

- `storage/database.ts`: DB connection pool management and initialization
- `storage/orders.ts`: All data persistence logic (DB-based, all async, includes submission tracking)

**Automation** (Lunchlab integration):

- `automation/lunchlab.ts`: Cookie-based authentication and session management
- `automation/lunchlab-api.ts`: API client for order submission and updates
- `automation/submitter.ts`: Orchestration layer with retry logic and notifications
- `automation/types.ts`: TypeScript interfaces for automation

**Utilities**:

- `utils/time.ts`: KST timezone utilities
- `utils/blocks.ts`: Slack Block Kit UI components

**Migrations**:

- `migrations/init.sql`: Database schema definition
- `migrations/migrate-json-to-db.ts`: JSON to DB migration script

## Environment Variables

Required in `.env`:

```bash
# Slack Configuration
SLACK_BOT_TOKEN=xoxb-...        # Bot User OAuth Token
SLACK_APP_TOKEN=xapp-...        # App-Level Token (Socket Mode)
SLACK_SIGNING_SECRET=...        # From Slack app settings
SLACK_CHANNEL_ID=C...           # Target channel ID
SLACK_ADMIN_IDS=U...,U...       # Comma-separated admin user IDs
TZ=Asia/Seoul                   # Timezone

# Database Configuration
DB_HOST=localhost               # MariaDB host
DB_PORT=3306                    # MariaDB port
DB_USER=root                    # Database user
DB_PASSWORD=...                 # Database password
DB_NAME=launch_bot              # Database name

# Lunchlab Automation (optional - only needed for automatic order submission)
LUNCHLAB_USERNAME=...           # Lunchlab username (not currently used with cookie auth)
LUNCHLAB_PASSWORD=...           # Lunchlab password (not currently used with cookie auth)
LUNCHLAB_BASE_URL=https://b2b.lunchlab.me
SCREENSHOTS_DIR=./screenshots   # Directory for error screenshots
LUNCHLAB_COOKIES=               # JSON array of cookies (production deployment)
                                # In development: cookies loaded from ./data/lunchlab-cookies.json
```

See `.env.example` for a complete template.

## Deployment (Cloudtype)

Uses GitHub Actions (`.github/workflows/deploy.yml`) to deploy on push to `main`.

Required GitHub Secrets:

- `CLOUDTYPE_TOKEN`: Cloudtype API key
- `GHP_TOKEN`: GitHub Personal Access Token

Cloudtype environment variables are set in Cloudtype dashboard (kebab-case names):

- `slack-bot-token`, `slack-app-token`, `slack-signing-secret`, `slack-channel-id`, `slack-admin-ids`
- `db-host`, `db-port`, `db-user`, `db-password`, `db-name`
- `lunchlab-base-url`, `lunchlab-cookies`, `screenshots-dir`

The workflow file needs the correct project path: `project: space-name/project-name`

**Note on Lunchlab Cookies**:

- In development: Store cookies in `./data/lunchlab-cookies.json`
- In production: Set `LUNCHLAB_COOKIES` environment variable with JSON array
- Cookies must be valid and not expired for automatic submission to work

### Setting up MariaDB on Cloudtype:

1. Create a MariaDB instance in your Cloudtype project
2. Note the connection details (host, port, user, password, database name)
3. Add DB environment variables to Cloudtype dashboard
4. Deploy the app - it will automatically create tables on first run
5. (Optional) Migrate existing JSON data using: `npx ts-node migrations/migrate-json-to-db.ts`

## Common Patterns

**Adding a new slash command**:

1. Create handler function in `handlers/`
2. Register in handler file using `app.command('/name', async ({ command, ack, respond }) => { ... })`
3. Import and call registration function in `index.ts` before `startBot()`
4. Add command in Slack App settings → Slash Commands

**Adding a new button action**:

1. Add button to message blocks with unique `action_id`
2. Register handler using `app.action('action_id', async ({ ack, body, client }) => { ... })`
3. Always call `await ack()` immediately

**Modifying message blocks**:

- Message blocks are created in `handlers/orderMessage.ts`: `createOrderBlocks()` and `sendClosedMessage()`
- Use Slack's Block Kit Builder to design: https://app.slack.com/block-kit-builder
- Maintain a clean, professional tone in text fields

**Working with orders**:

- All storage functions are async - always use `await`
- Always use `formatDate()` for date keys (ensures KST)
- Check `isAfterOrderDeadline()` before accepting orders
- Check `todayOrders.closed` for manual close status
- Use `await addOrder()` which handles both new orders and updates (uses ON DUPLICATE KEY UPDATE)
- After adding/updating order, call `submitOrdersIfReady()` to check if auto-submission should trigger

**Lunchlab automation**:

- `submitOrdersIfReady(orderDate, channelId)`: Check order count and submit if >= 3 orders (only if not already submitted)
- `updateSubmittedOrder(orderDate, channelId)`: Update already-submitted order with new counts
- Both functions handle retries, notifications, and error logging automatically
- Submission status tracked in `order_sessions` table (`submitted`, `submission_id` columns)

**Database operations**:

- Connection pool is initialized on app startup (`initializeDatabase()`)
- Tables are created automatically if they don't exist
- All queries use parameterized statements to prevent SQL injection
- Connection pool is properly closed on graceful shutdown
- For manual DB queries, always get/release connections properly:
  ```typescript
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query("SELECT ...");
    // ... use rows
  } finally {
    connection.release();
  }
  ```
