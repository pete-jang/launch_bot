# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Slack bot for daily lunch ordering that automatically posts order messages at noon on weekdays and closes orders at 2 PM. Uses Socket Mode (no webhooks) and stores data in MariaDB database.

## Development Policy

**Automatic Git Commits and Pushes**:
- Commit and push changes immediately after completing any task or making meaningful changes
- Use descriptive commit messages that explain what was changed and why
- This ensures changes are backed up and deployed automatically via GitHub Actions

## Essential Commands

### Development
```bash
npm run dev        # Run with ts-node (development)
npm run build      # Compile TypeScript
npm start          # Run compiled code (production)
npm run watch      # Watch mode for TypeScript compilation
```

### Testing the Bot Locally
1. Ensure `.env` is configured with valid Slack tokens
2. Run `npm run dev`
3. Test in Slack:
   - `/주문시작` - Manually trigger order message
   - `/주문내역` - View order history (supports: 오늘, 이번주, 이번달, YYYY-MM-DD, YYYY-MM-DD~YYYY-MM-DD)
   - Click menu buttons (🍚 가정식, 🥗 프레시밀) to place orders

## Architecture

### Application Flow

1. **Startup** (`index.ts`):
   - Registers handlers → Starts bot → Initializes scheduler
   - Handlers are registered BEFORE bot starts (critical order)

2. **Handler Registration Pattern**:
   - `registerOrderInteraction()`: Button click handlers for menu selection
   - `registerQueryCommand()`: Slash command + button handlers for order queries
   - `registerStartCommand()`: Manual order start command
   - All handlers use `app.action()`, `app.command()`, registered in handler files

3. **Scheduler** (`scheduler.ts`):
   - Uses `node-schedule` with cron patterns
   - `0 12 * * 1-5`: Daily order message at noon (Mon-Fri)
   - `0 14 * * 1-5`: Auto-close orders at 2 PM (Mon-Fri)
   - Checks `isMessageSent()` to prevent duplicate messages if manual start was used

4. **Data Storage** (`storage/orders.ts` + `storage/database.ts`):
   - MariaDB/MySQL database with two tables:
     - `orders`: Individual order records (order_date, user_id, user_name, menu_type, ordered_at)
     - `order_sessions`: Daily session info (order_date, closed, message_ts, message_sent)
   - All functions are async and use connection pooling
   - Connection pool initialized on startup (`initializeDatabase()`)
   - User can change their order multiple times before closing (using ON DUPLICATE KEY UPDATE)

5. **Message Updates** (`handlers/orderMessage.ts`):
   - When order button clicked → updates message with current order count
   - Uses saved `messageTs` to update the original message
   - At 2 PM → sends closed message (updates original or posts new)

### Critical Implementation Details

**Timezone Handling**:
- All time operations use `moment-timezone` with `Asia/Seoul`
- `getCurrentKST()` returns moment object in KST
- `formatDate()` returns YYYY-MM-DD in KST
- Environment variable `TZ=Asia/Seoul` should be set

**Message Tone**:
- All user-facing messages use a humorous "nagging mother-in-law" tone (애미야...)
- This is intentional and part of the bot's personality
- Examples: "애미야, 2시 지났다니까? 뭐 하다가 이제 주문하는거니?"

**Order State Management**:
- `closed: false` → accepting orders
- `closed: true` → orders locked
- `messageSent: true` → prevents duplicate auto-messages
- Users can update their order before closing (replaces existing order)

**Socket Mode**:
- Uses `socketMode: true` in Bolt config
- Requires `SLACK_APP_TOKEN` (xapp-...) and `SLACK_BOT_TOKEN` (xoxb-...)
- No webhook URLs needed

### File Responsibilities

- `bot.ts`: Slack App initialization, exports `app` instance and helpers
- `scheduler.ts`: Cron jobs for auto-messages and auto-close
- `handlers/orderMessage.ts`: Creates/updates order messages, sends closed message
- `handlers/orderInteraction.ts`: Handles button clicks (order_가정식, order_프레시밀)
- `handlers/queryCommand.ts`: `/주문내역` command with period filtering logic
- `handlers/startCommand.ts`: `/주문시작` manual trigger with validation
- `storage/database.ts`: DB connection pool management and initialization
- `storage/orders.ts`: All data persistence logic (DB-based, all async)
- `utils/time.ts`: KST timezone utilities
- `migrations/init.sql`: Database schema definition
- `migrations/migrate-json-to-db.ts`: JSON to DB migration script

## Environment Variables

Required in `.env`:
```
SLACK_BOT_TOKEN=xoxb-...        # Bot User OAuth Token
SLACK_APP_TOKEN=xapp-...        # App-Level Token (Socket Mode)
SLACK_SIGNING_SECRET=...        # From Slack app settings
SLACK_CHANNEL_ID=C...           # Target channel ID
TZ=Asia/Seoul                   # Timezone

# Database Configuration
DB_HOST=localhost               # MariaDB host (Cloudtype: maria-xxx.cloudtype.app)
DB_PORT=3306                    # MariaDB port
DB_USER=root                    # Database user
DB_PASSWORD=...                 # Database password
DB_NAME=launch_bot              # Database name
```

## Deployment (Cloudtype)

Uses GitHub Actions (`.github/workflows/deploy.yml`) to deploy on push to `main`.

Required GitHub Secrets:
- `CLOUDTYPE_TOKEN`: Cloudtype API key
- `GHP_TOKEN`: GitHub Personal Access Token

Cloudtype environment variables are set in Cloudtype dashboard (kebab-case names):
- `slack-bot-token`, `slack-app-token`, `slack-signing-secret`, `slack-channel-id`
- `db-host`, `db-port`, `db-user`, `db-password`, `db-name`

The workflow file needs the correct project path: `project: space-name/project-name`

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
- Maintain the humorous tone in text fields

**Working with orders**:
- All storage functions are async - always use `await`
- Always use `formatDate()` for date keys (ensures KST)
- Check `isAfterOrderDeadline()` before accepting orders
- Check `todayOrders.closed` for manual close status
- Use `await addOrder()` which handles both new orders and updates (uses ON DUPLICATE KEY UPDATE)

**Database operations**:
- Connection pool is initialized on app startup (`initializeDatabase()`)
- Tables are created automatically if they don't exist
- All queries use parameterized statements to prevent SQL injection
- Connection pool is properly closed on graceful shutdown
- For manual DB queries, always get/release connections properly:
  ```typescript
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query('SELECT ...');
    // ... use rows
  } finally {
    connection.release();
  }
  ```
