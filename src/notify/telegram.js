const TelegramBot = require('node-telegram-bot-api');
const { formatSignalMessage } = require('./format');

let bot = null;
const DRY_RUN = process.env.DRY_RUN === 'true';

/**
 * Initialize Telegram bot
 */
function initTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[Telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    console.warn('[Telegram] Running in DRY_RUN mode (no messages will be sent)');
    return null;
  }

  if (DRY_RUN) {
    console.log('[Telegram] DRY_RUN mode enabled - messages will be logged but not sent');
    return null;
  }

  console.log('[Telegram] Initializing Telegram bot...');
  bot = new TelegramBot(token, { polling: false });
  
  console.log('[Telegram] Telegram bot initialized successfully');
  return bot;
}

/**
 * Send a signal message to Telegram
 * @param {Object} signal - Signal object with all details
 * @returns {Promise<boolean>} Success status
 */
async function sendSignal(signal) {
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Format the message
  const message = formatSignalMessage(signal);

  // If DRY_RUN, just log
  if (DRY_RUN || !bot) {
    console.log('\n' + '='.repeat(60));
    console.log('[Telegram] DRY_RUN - Would send message:');
    console.log('='.repeat(60));
    console.log(message);
    console.log('='.repeat(60) + '\n');
    return true;
  }

  try {
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });

    console.log(`[Telegram] Successfully sent signal for ${signal.symbol} ${signal.timeframe}`);
    return true;

  } catch (err) {
    console.error('[Telegram] Error sending message:', err.message);
    
    // Log the message that failed for debugging
    console.error('[Telegram] Failed message:');
    console.error(message);
    
    return false;
  }
}

/**
 * Send a simple text message (for notifications, errors, etc.)
 * @param {string} text - Message text
 * @returns {Promise<boolean>}
 */
async function sendMessage(text) {
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (DRY_RUN || !bot) {
    console.log(`[Telegram] DRY_RUN - Would send: ${text}`);
    return true;
  }

  try {
    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown'
    });
    return true;
  } catch (err) {
    console.error('[Telegram] Error sending message:', err.message);
    return false;
  }
}

/**
 * Test Telegram connection
 */
async function testConnection() {
  if (DRY_RUN || !bot) {
    console.log('[Telegram] DRY_RUN mode - skipping connection test');
    return true;
  }

  try {
    const me = await bot.getMe();
    console.log(`[Telegram] Connected as @${me.username}`);
    return true;
  } catch (err) {
    console.error('[Telegram] Connection test failed:', err.message);
    return false;
  }
}

module.exports = {
  initTelegram,
  sendSignal,
  sendMessage,
  testConnection
};
