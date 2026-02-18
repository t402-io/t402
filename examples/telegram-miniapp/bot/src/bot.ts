import { config } from 'dotenv'
import { Bot } from 'grammy'
import { handleStart, handleHelp, handleAbout } from './commands.js'

config()

const BOT_TOKEN = process.env.BOT_TOKEN
if (!BOT_TOKEN) {
  console.error('BOT_TOKEN environment variable is required')
  console.error('Get one from @BotFather on Telegram')
  process.exit(1)
}

const bot = new Bot(BOT_TOKEN)

// Register command handlers
bot.command('start', handleStart)
bot.command('help', handleHelp)
bot.command('about', handleAbout)

// Handle errors
bot.catch((err) => {
  console.error('Bot error:', err)
})

// Start the bot
bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} is running`)
    console.log('Commands: /start, /help, /about')
  },
})
