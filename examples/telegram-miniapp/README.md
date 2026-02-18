# Telegram Mini App + t402 Payment Demo

A complete example of a Telegram Mini App that uses the t402 payment protocol
to sell premium content via TON stablecoin payments.

## Architecture

```
User opens Mini App in Telegram
  |
  v
Frontend (React + TON Connect)
  |-- Fetches premium content from backend
  |-- Receives 402 Payment Required
  |-- Signs TON USDT Jetton transfer via TON Connect
  |-- Resubmits request with Payment-Signature header
  |
  v
Backend (Express + @t402/express + @t402/ton)
  |-- Returns 402 for protected routes
  |-- Verifies payment via facilitator
  |-- Serves content after verification
  |
  v
Bot (grammy)
  |-- /start command with Mini App button
  |-- Inline Web App launch
```

## Prerequisites

- Node.js 18+
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- A TON wallet address for receiving payments
- Access to a t402 facilitator instance

## Setup

### 1. Register a Telegram Bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram
2. Send `/newbot` and follow the prompts
3. Save the bot token
4. Send `/newapp` to register a Mini App
5. Set the Mini App URL to your frontend URL (e.g., `https://your-domain.com`)

### 2. Configure Environment

Create a `.env` file in each directory:

**`backend/.env`**:
```
PORT=4021
FACILITATOR_URL=https://facilitator.t402.io
TON_ADDRESS=EQYourTonWalletAddress
TON_NETWORK=ton:mainnet
```

**`bot/.env`**:
```
BOT_TOKEN=your_bot_token_from_botfather
MINIAPP_URL=https://your-domain.com
```

**`frontend/.env`**:
```
VITE_API_URL=http://localhost:4021
VITE_TON_CONNECT_MANIFEST_URL=https://your-domain.com/tonconnect-manifest.json
```

### 3. Install and Run

```bash
# Backend
cd backend
npm install
npm run dev

# Bot (separate terminal)
cd bot
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Payment Flow

1. User opens the Mini App via the Telegram bot
2. User connects their TON wallet via TON Connect
3. User taps "Unlock Premium Content"
4. Frontend sends GET request to `/api/content/premium`
5. Backend returns `402 Payment Required` with TON payment details
6. Frontend displays payment details and prompts wallet signing
7. User approves the TON USDT Jetton transfer in their wallet
8. Frontend resubmits the request with the `Payment-Signature` header
9. Backend verifies the payment via the t402 facilitator
10. Backend returns the premium content

## Project Structure

```
telegram-miniapp/
  frontend/
    src/
      App.tsx              - Main app with routing
      PaymentPage.tsx      - Content purchase page
      WalletConnect.tsx    - TON Connect wallet button
      api.ts               - Backend API wrapper
      types.ts             - Shared TypeScript types
    public/
      index.html           - HTML entry point
    package.json
    tsconfig.json
  backend/
    src/
      server.ts            - Express server with t402 middleware
      routes.ts            - Protected content routes
      config.ts            - Environment configuration
    package.json
    tsconfig.json
  bot/
    src/
      bot.ts               - Telegram bot with Mini App button
      commands.ts          - Bot command handlers
    package.json
```

## Technologies

- **Frontend**: React, TON Connect SDK (`@twa-dev/sdk`), `@t402/core`
- **Backend**: Express, `@t402/express`, `@t402/ton`
- **Bot**: grammy (Telegram Bot Framework)
- **Payment**: t402 protocol over TON network (USDT Jetton)

## License

Apache-2.0
