# PA-Bot: Price Action + Volume Signal Bot

**Signal-only trading alert bot for Binance USDT-M futures** focusing on Price Action and Volume analysis with RSI divergence detection.

⚠️ **DISCLAIMER**: This bot provides trading signals for educational purposes only. It does NOT execute trades automatically. All trading decisions and their consequences are the sole responsibility of the user. Cryptocurrency trading carries substantial risk of loss.

## Features

- 📊 **Multi-Timeframe Analysis**: Monitors 1d, 4h, 1h timeframes (configurable)
- 🎯 **Advanced Price Action Engine**: 
  - Market regime detection (trend/range/expansion) using ATR and structure
  - BOS (Break of Structure) and CHoCH (Change of Character) detection
  - Liquidity sweep detection for stop hunts and reversals
  - Enhanced candlestick pattern library (tweezers, morning/evening star, inside bars, 2-bar reversals)
  - Swing/pivot detection and market structure analysis
  - Support/resistance zone building and validation
- 📈 **Volume Analysis**: Volume spike detection and context analysis
- 🔄 **RSI Divergence**: Detects bullish/bearish divergences at pivot points
- 🎨 **Multiple Setup Types**: Reversals, breakouts, retests, and false breakout fades
- ⚡ **Real-Time WebSocket**: Live data from Binance with auto-reconnect
- 📱 **Professional Telegram Alerts**: Clean, HTML-formatted signals with structured reasoning
- 🗄️ **SQLite Storage**: Persistent signal history and cooldown management
- 🚫 **Smart Deduplication**: Configurable cooldown system to prevent spam
- 🏆 **Signal Scoring**: 0-100 score based on multiple factors
- ⚙️ **Flexible Configuration**: Pro/Aggressive modes with configurable filters

## Requirements

- **Node.js**: v18.0.0 or higher
- **npm**: Package manager
- **Binance Account**: Not required for data access (public API)
- **Telegram Bot**: Bot token and chat ID for notifications

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/posiyatu2037-eng/pa-bot.git
cd pa-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the example environment file and edit it:

```bash
cp .env.example .env
nano .env  # or use your preferred editor
```

**Required Variables:**

```env
# Symbols to monitor (comma-separated)
SYMBOLS=BTCUSDT,ETHUSDT,BNBUSDT

# Timeframes to monitor (default: 1d,4h,1h for pro-grade PA)
TIMEFRAMES=1d,4h,1h

# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# Signal Configuration
# Signal mode: 'pro' (default, strict filters) or 'aggressive' (relaxed filters)
SIGNAL_MODE=pro
SIGNAL_COOLDOWN_MINUTES=60  # Set to 0 to disable
MIN_SIGNAL_SCORE=70          # Set to 0 to disable

# Price Action Configuration
PIVOT_WINDOW=5
ZONE_LOOKBACK=100
ZONE_TOLERANCE_PCT=0.5
VOLUME_SPIKE_THRESHOLD=1.5
ATR_PERIOD=14                # For regime detection
SWEEP_LOOKBACK=5             # Liquidity sweep lookback
STRUCTURE_LOOKBACK=3         # BOS/CHoCH lookback

# Zone-based SL/TP Configuration
ZONE_SL_BUFFER_PCT=0.2
MIN_ZONES_REQUIRED=2         # Set to 0 to allow signals without zones

# Application Settings
DRY_RUN=false
LOG_LEVEL=info
```

**Signal Mode Options:**

- **`pro` (default)**: Strict filtering for high-quality signals
  - Minimum score: 70
  - Minimum zones: 2
  - Cooldown: 60 minutes
  
- **`aggressive`**: Relaxed filtering for more signals
  - Minimum score: 50
  - Minimum zones: 0 (allows signals without zones)
  - Cooldown: 30 minutes

### 4. Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the instructions
3. Copy the bot token and add it to `.env` as `TELEGRAM_BOT_TOKEN`
4. Start a chat with your bot
5. Get your chat ID by sending a message to your bot, then visiting:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
6. Look for `"chat":{"id":123456789}` in the response
7. Add the chat ID to `.env` as `TELEGRAM_CHAT_ID`

## Configuration

### Symbol Mapping

- **XAUUSD**: Automatically mapped to **XAUUSDT** if it exists on Binance Futures
- Only active (TRADING status) symbols are validated
- Invalid symbols are automatically filtered out

### Timeframe Mode B (Default - Pro-Grade)

Optimized for stability with professional price action analysis:
- **1d**: Daily trend analysis for HTF bias (Higher Timeframe context)
- **4h**: Major swing structure and zone identification
- **1h**: Primary entry/analysis timeframe

**Note**: The 15m timeframe has been removed from the default configuration to focus on higher-quality, higher-timeframe setups that align with professional trading methodologies.

### Signal Scoring System (0-100)

Signals are scored based on multiple factors:

| Factor | Max Points | Description |
|--------|------------|-------------|
| HTF Alignment | 30 | 1d & 4h structure alignment with signal direction |
| Setup Quality | 25 | Reversal patterns, true breakouts, retests |
| Candle Strength | 20 | Directional momentum of current candle |
| Volume Context | 15 | Volume spike and comparison to average |
| RSI Divergence | 10 | Bullish/bearish divergence confluence |

**Default Minimum Score**: 70/100

### Cooldown System

Prevents duplicate signals for the same setup:
- **Key**: `symbol_timeframe_side_zoneKey`
- **Default Duration**: 60 minutes (configurable, set to 0 to disable)
- **Database**: Persistent across restarts

## Upgrade Notes

### New Features in Latest Version

This version includes major enhancements to the price action engine and Telegram notifications:

**Price Action Engine Upgrades:**
- ✨ Market regime detection (trend/range/expansion) using ATR and structure analysis
- ✨ BOS (Break of Structure) and CHoCH (Change of Character) detection for SMC-style analysis
- ✨ Liquidity sweep detection to identify stop hunts and reversals
- ✨ Enhanced candlestick patterns: tweezer top/bottom, morning/evening star, inside bar, 2-bar reversals
- ✨ Configurable signal modes: `pro` (strict) and `aggressive` (relaxed)
- ✨ Structured skip logging with clear reasons when signals are filtered

**Telegram Notification Improvements:**
- ✨ Switched from MarkdownV2 to HTML for cleaner formatting
- ✨ Professional, minimal layout with reduced decorative characters
- ✨ Clearer "Lý do vào kèo" (Reasons) section with regime, BOS/CHoCH, and sweep info
- ✨ Better organized trade plan display

**Configuration Changes:**
- Add new environment variables (see `.env.example`):
  - `SIGNAL_MODE` - Choose between `pro` and `aggressive` modes
  - `ATR_PERIOD` - ATR period for regime detection (default: 14)
  - `SWEEP_LOOKBACK` - Liquidity sweep lookback (default: 5)
  - `STRUCTURE_LOOKBACK` - BOS/CHoCH lookback (default: 3)
- Existing configs remain backward compatible
- Set `MIN_SIGNAL_SCORE=0`, `MIN_ZONES_REQUIRED=0`, or `SIGNAL_COOLDOWN_MINUTES=0` to disable respective filters

**For Existing Users:**
1. Update your `.env` file with new variables from `.env.example`
2. Choose your preferred `SIGNAL_MODE` (`pro` recommended for quality, `aggressive` for quantity)
3. Adjust filter thresholds as needed
4. Telegram messages will appear cleaner and more professional automatically

## Usage

### Development Mode

Run the bot with console output:

```bash
npm start
```

Or with Node.js directly:

```bash
node src/index.js
```

### Dry Run Mode

Test without sending Telegram messages:

```bash
DRY_RUN=true npm start
```

Signals will be logged to console in formatted output.

### Production with PM2

Install PM2 globally:

```bash
npm install -g pm2
```

Start the bot:

```bash
pm2 start src/index.js --name pa-bot
```

Monitor:

```bash
pm2 logs pa-bot
pm2 status
```

Setup auto-restart on reboot:

```bash
pm2 startup
pm2 save
```

### Production with systemd

**Note**: Adjust paths in `deploy/pa-bot.service` to match your setup.

1. **Copy service file**:
   ```bash
   sudo cp deploy/pa-bot.service /etc/systemd/system/
   ```

2. **Edit service file** with your paths and user:
   ```bash
   sudo nano /etc/systemd/system/pa-bot.service
   ```

3. **Create log directory**:
   ```bash
   sudo mkdir -p /var/log/pa-bot
   sudo chown $USER:$USER /var/log/pa-bot
   ```

4. **Enable and start**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable pa-bot
   sudo systemctl start pa-bot
   ```

5. **Check status**:
   ```bash
   sudo systemctl status pa-bot
   sudo journalctl -u pa-bot -f
   ```

## Signal Format

Signals are sent to Telegram in this format:

```
🚨 LONG SIGNAL 🚨

Symbol:    BTCUSDT
Timeframe: 1h
Side:      LONG
Score:     85/100

✅ HTF Bias: BULLISH
  - 1D: up, 4H: up

📍 Setup: Bullish Reversal at Support
  - Zone: support @ 43250.50

Entry:  43300.00000000
SL:     43100.00000000
TP1:    43600.00000000 (1.5R)
TP2:    43900.00000000 (3.0R)

📊 Volume: 1.85x avg ⚡ SPIKE

📈 RSI Divergence: bullish
  - Bullish divergence: Price LL @ 43150.20, RSI HL (32.45 > 28.30)

Key Points:
  • HTF Bias: BULLISH (1D: up, 4H: up)
  • Setup: Bullish Reversal at Support
  • Pattern: Hammer (strength: 75%)
  • Volume: 1.85x average (SPIKE)
  • RSI Divergence: Bullish divergence...
  • Zone: support @ 43250.50

🕐 2026-02-11T14:30:00.000Z

--------------------
PA-Bot | Price Action + Volume Analysis
```

## Project Structure

```
pa-bot/
├── src/
│   ├── app/
│   │   └── engine.js          # Main signal detection engine
│   ├── binance/
│   │   ├── rest.js            # REST API client
│   │   ├── ws.js              # WebSocket client with reconnect
│   │   ├── exchangeInfo.js    # Symbol validation
│   │   └── klinesCache.js     # In-memory klines cache
│   ├── indicators/
│   │   └── rsi.js             # RSI calculation & divergence
│   ├── pa/                    # Price Action modules
│   │   ├── pivots.js          # Swing/pivot detection
│   │   ├── structure.js       # Market structure & HTF bias
│   │   ├── zones.js           # Support/resistance zones
│   │   ├── patterns.js        # Candlestick patterns
│   │   ├── setups.js          # Setup detection
│   │   └── score.js           # Signal scoring & levels
│   ├── store/                 # Database modules
│   │   ├── db.js              # SQLite initialization
│   │   ├── cooldown.js        # Cooldown management
│   │   └── signals.js         # Signal persistence
│   ├── notify/                # Notification modules
│   │   ├── format.js          # Message formatting
│   │   └── telegram.js        # Telegram bot client
│   └── index.js               # Application entry point
├── deploy/
│   └── pa-bot.service         # systemd service unit
├── data/                      # Created at runtime
│   └── signals.db             # SQLite database
├── .env.example               # Environment template
├── .gitignore
├── package.json
└── README.md
```

## Troubleshooting

### WebSocket Disconnections

The bot has automatic reconnection with exponential backoff. If disconnections persist:
- Check your internet connection
- Verify Binance API is accessible
- Check for rate limiting

### Telegram Errors

If messages fail to send:
1. Verify `TELEGRAM_BOT_TOKEN` is correct
2. Verify `TELEGRAM_CHAT_ID` is correct
3. Ensure the bot has been started (send `/start` to your bot)
4. Check Telegram API status

### Database Errors

If database errors occur:
- Ensure the `data/` directory is writable
- Check disk space
- Verify `DB_PATH` is accessible

### No Signals Generated

If no signals are appearing:
1. Check `MIN_SIGNAL_SCORE` - try lowering it temporarily
2. Verify symbols are valid and trading
3. Check logs for setup detection messages
4. Enable `DRY_RUN=true` to see would-be signals
5. Ensure sufficient historical data has been loaded

### Rate Limiting

Binance has rate limits. The bot:
- Uses REST API only for initial data fetch
- Uses WebSocket for real-time updates (no rate limit)
- Adds small delays between initial fetch requests

## Development

### Adding New Indicators

Create a new file in `src/indicators/` and import it in `src/app/engine.js`.

### Adding New Setup Types

Implement detection logic in `src/pa/setups.js` and update scoring in `src/pa/score.js`.

### Modifying Signal Format

Edit `src/notify/format.js` to customize message appearance.

## Performance

- **Memory Usage**: ~50-100 MB (depends on symbol/timeframe count)
- **CPU Usage**: Minimal (event-driven architecture)
- **Network**: WebSocket connection with periodic pings
- **Database**: SQLite with WAL mode for performance

## Security

- **No Trading**: Bot only generates signals, never executes trades
- **No API Keys**: Does not require Binance API keys (uses public data)
- **Environment Variables**: Sensitive data in `.env` (not committed)
- **Telegram**: Uses official node-telegram-bot-api library

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

For issues and questions:
- **GitHub Issues**: [Create an issue](https://github.com/posiyatu2037-eng/pa-bot/issues)
- **Documentation**: This README and inline code comments

## Changelog

### v1.0.0 (2026-02-11)
- Initial release
- Multi-timeframe price action analysis
- Volume spike detection
- RSI divergence detection
- Telegram notifications
- SQLite persistence
- Cooldown system
- Scoring system (0-100)
- WebSocket with auto-reconnect

---

**Remember**: This bot provides signals only. Always do your own research and never risk more than you can afford to lose.
