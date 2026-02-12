require('dotenv').config();

const { validateSymbols } = require('./binance/exchangeInfo');
const { fetchKlines } = require('./binance/rest');
const klinesCache = require('./binance/klinesCache');
const binanceWS = require('./binance/ws');
const { initDatabase, cleanupExpiredCooldowns } = require('./store/db');
const { initTelegram, testConnection, sendMessage } = require('./notify/telegram');
const SignalEngine = require('./app/engine');

/**
 * Main application entry point
 */
class PABot {
  constructor() {
    this.symbols = [];
    this.timeframes = [];
    this.engine = null;
  }

  /**
   * Initialize the application
   */
  async init() {
    console.log('='.repeat(60));
    console.log('PA-Bot: Price Action + Volume Signal Bot');
    console.log('='.repeat(60));
    console.log();

    try {
      // 1. Load configuration
      this.loadConfig();

      // 2. Initialize database
      initDatabase();

      // 3. Clean up expired cooldowns
      cleanupExpiredCooldowns();

      // 4. Initialize Telegram
      initTelegram();
      await testConnection();

      // 5. Validate symbols
      console.log('[Init] Validating symbols...');
      this.symbols = await validateSymbols(this.rawSymbols);
      console.log('[Init] Validated symbols:', this.symbols.join(', '));

      if (this.symbols.length === 0) {
        throw new Error('No valid symbols to monitor');
      }

      // 6. Initialize signal engine
      this.engine = new SignalEngine();

      // 7. Fetch initial historical data
      await this.fetchInitialData();

      // 8. Connect to WebSocket
      this.connectWebSocket();

      // 9. Setup periodic cleanup
      this.setupCleanup();

      // 10. Send startup notification
      await this.sendStartupNotification();

      console.log();
      console.log('='.repeat(60));
      console.log('✅ PA-Bot started successfully!');
      console.log('='.repeat(60));
      console.log();

    } catch (err) {
      console.error('❌ Failed to initialize PA-Bot:', err.message);
      console.error(err.stack);
      process.exit(1);
    }
  }

  /**
   * Load configuration from environment
   */
  loadConfig() {
    // Parse symbols
    const symbolsEnv = process.env.SYMBOLS || 'BTCUSDT,ETHUSDT';
    this.rawSymbols = symbolsEnv.split(',').map(s => s.trim()).filter(s => s);

    // Parse timeframes
    const timeframesEnv = process.env.TIMEFRAMES || '1d,4h,1h';
    this.timeframes = timeframesEnv.split(',').map(tf => tf.trim()).filter(tf => tf);

    console.log('[Config] Symbols:', this.rawSymbols.join(', '));
    console.log('[Config] Timeframes:', this.timeframes.join(', '));
    console.log('[Config] Min Score:', process.env.MIN_SIGNAL_SCORE || 70);
    console.log('[Config] Cooldown:', process.env.SIGNAL_COOLDOWN_MINUTES || 60, 'minutes');
    console.log('[Config] DRY_RUN:', process.env.DRY_RUN === 'true' ? 'YES' : 'NO');
  }

  /**
   * Fetch initial historical klines data
   */
  async fetchInitialData() {
    console.log('[Init] Fetching initial historical data...');

    for (const symbol of this.symbols) {
      for (const timeframe of this.timeframes) {
        try {
          console.log(`[Init] Fetching ${symbol} ${timeframe}...`);
          
          // Fetch last 500 candles
          const klines = await fetchKlines(symbol, timeframe, 500);
          
          // Initialize cache
          klinesCache.init(symbol, timeframe, klines);
          
          console.log(`[Init] ✓ ${symbol} ${timeframe}: ${klines.length} candles`);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (err) {
          console.error(`[Init] ✗ Failed to fetch ${symbol} ${timeframe}:`, err.message);
        }
      }
    }

    console.log('[Init] Initial data fetch complete');
  }

  /**
   * Connect to Binance WebSocket
   */
  connectWebSocket() {
    console.log('[Init] Connecting to Binance WebSocket...');

    binanceWS.connect(
      this.symbols,
      this.timeframes,
      (symbol, timeframe, candle) => {
        // Pass closed candle to engine
        this.engine.onCandleClosed(symbol, timeframe, candle);
      },
      (symbol, timeframe, formingCandle) => {
        // Pass forming candle to engine for intrabar analysis
        this.engine.onIntrabarUpdate(symbol, timeframe, formingCandle);
      }
    );
  }

  /**
   * Setup periodic cleanup tasks
   */
  setupCleanup() {
    // Clean up expired cooldowns every hour
    setInterval(() => {
      console.log('[Cleanup] Running periodic cleanup...');
      cleanupExpiredCooldowns();
    }, 60 * 60 * 1000);
  }

  /**
   * Send startup notification
   */
  async sendStartupNotification() {
    const message = `🚀 *PA\\-Bot Started*\n\n` +
      `Monitoring: ${this.symbols.length} symbols\n` +
      `Timeframes: ${this.timeframes.join(', ')}\n` +
      `Min Score: ${process.env.MIN_SIGNAL_SCORE || 70}\n` +
      `Cooldown: ${process.env.SIGNAL_COOLDOWN_MINUTES || 60}m`;

    await sendMessage(message);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('\n[Shutdown] Shutting down PA-Bot...');

    try {
      // Close WebSocket
      binanceWS.close();

      // Close database
      const { closeDatabase } = require('./store/db');
      closeDatabase();

      console.log('[Shutdown] ✓ Shutdown complete');
      process.exit(0);
    } catch (err) {
      console.error('[Shutdown] Error during shutdown:', err.message);
      process.exit(1);
    }
  }
}

// Create and start the bot
const bot = new PABot();

// Handle shutdown signals
process.on('SIGINT', () => bot.shutdown());
process.on('SIGTERM', () => bot.shutdown());

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  bot.shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the bot
bot.init().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
