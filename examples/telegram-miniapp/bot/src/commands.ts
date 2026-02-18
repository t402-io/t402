import type { Context } from 'grammy'

const MINIAPP_URL = process.env.MINIAPP_URL || 'https://your-domain.com'

/**
 * /start command handler.
 *
 * Sends a welcome message with a button to open the Mini App.
 */
export async function handleStart(ctx: Context) {
  await ctx.reply(
    'Welcome to the t402 Content Store!\n\n' +
    'Browse and purchase premium content with TON USDT payments.\n\n' +
    'Tap the button below to open the store.',
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Open Content Store',
              web_app: { url: MINIAPP_URL },
            },
          ],
        ],
      },
    },
  )
}

/**
 * /help command handler.
 */
export async function handleHelp(ctx: Context) {
  await ctx.reply(
    'How to use:\n\n' +
    '1. Tap "Open Content Store" to launch the Mini App\n' +
    '2. Connect your TON wallet\n' +
    '3. Browse available content\n' +
    '4. Tap "Unlock" to purchase with USDT\n' +
    '5. Confirm the payment in your wallet\n\n' +
    'Payments are processed via the t402 protocol on the TON network.',
  )
}

/**
 * /about command handler.
 */
export async function handleAbout(ctx: Context) {
  await ctx.reply(
    't402 Content Store\n\n' +
    'This Mini App demonstrates the t402 HTTP payment protocol ' +
    'for micropayments using USDT on the TON network.\n\n' +
    'Learn more: https://t402.io',
  )
}
