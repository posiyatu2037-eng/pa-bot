# PA-Bot: Price Action + Volume Signal Bot

**Signal-only trading alert bot for Binance USDT-M futures** focusing on Price Action and Volume analysis with RSI divergence detection.

⚠️ **DISCLAIMER**: This bot provides trading signals for educational purposes only. It does NOT execute trades automatically. All trading decisions and their consequences are the sole responsibility of the user. Cryptocurrency trading carries substantial risk of loss.

## Features

### Core Features

- 📊 **Multi-Timeframe Analysis**: Monitors 1d, 4h, 1h timeframes (configurable)
- 🎯 **Price Action Focus**: Swing/pivot detection, market structure analysis, support/resistance zones
- 📈 **Volume Analysis**: Volume spike detection and climax identification
- 🔄 **RSI Divergence**: Detects bullish/bearish divergences (bonus scoring)
- 🎨 **Multiple Setup Types**: Reversals, breakouts, retests, and false breakout fades
- ⚡ **Real-Time WebSocket**: Live data from Binance with auto-reconnect
- 📱 **Telegram Alerts**: Formatted signals with all key information
- 🗄️ **SQLite Storage**: Persistent signal history and cooldown management
- 🚫 **Deduplication**: Smart cooldown system to prevent spam
- 🏆 **Signal Scoring**: 0-110 score based on multiple factors

### NEW: Advanced Signal Engine

- 🎚️ **Two-Stage Alerts**: 
  - **SETUP**: Early warning when reversal/continuation setup is forming (intrabar detection)
  - **ENTRY**: Confirmed signal with clear entry/SL/TP, ready for action
- 🚦 **Anti-Chase Logic**: Prevents late entries with intelligent chase detection
  - ATR-based distance checks
  - Volume climax detection
  - Momentum analysis
  - Micro-structure analysis (CHoCH/BOS)
- 🎭 **Enhanced Patterns**: 
  - Pin bar (hammer/shooting star)
  - Engulfing patterns
  - Inside bar + break
  - Morning/evening star
  - Tweezer top/bottom
  - Doji patterns
- 📊 **Configurable Scoring**: 
  - Separate thresholds for SETUP (50) and ENTRY (70)
  - RSI divergence as bonus (not required)
  - Price action and volume confirmation required
- ✅ **Quality Filters**:
  - Minimum R:R ratio (default 1.5)
  - HTF alignment requirement for ENTRY
  - Volume confirmation option
- 📈 **Backtesting Tool**: Evaluate signal quality on historical data
  - Per-symbol and per-timeframe reporting
  - Win rate, avg R:R, and expectancy calculation

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

# Optional: Send to Telegram group (e.g., -1001234567890)
TELEGRAM_GROUP_ID=

# Optional: Enable startup/connection test messages (default: false)
TELEGRAM_SEND_STARTUP=false
TELEGRAM_SEND_CONNECTION_TEST=false

# Optional: Customize signal source footer (default: "Posiya Tú zalo 0763888872")
SIGNAL_SOURCE_TEXT=Posiya Tú zalo 0763888872

# Signal Configuration
SIGNAL_COOLDOWN_MINUTES=60
MIN_SIGNAL_SCORE=70  # Legacy, kept for backward compatibility

# Two-Stage Alerts Configuration
ENTRY_TIMEFRAMES=1h             # Timeframe(s) for entry signals
HTF_TIMEFRAMES=4h,1d            # Higher timeframes for bias
SIGNAL_STAGE_ENABLED=setup,entry  # Enable both stages
SETUP_SCORE_THRESHOLD=50        # Score threshold for SETUP alerts
ENTRY_SCORE_THRESHOLD=70        # Score threshold for ENTRY alerts

# Risk & Quality Filters
MIN_RR=1.5                      # Minimum risk-reward ratio

# Anti-Chase Configuration
ANTI_CHASE_MAX_ATR=2.0          # Max ATR multiple for chase detection
ANTI_CHASE_MAX_PCT=3.0          # Max percentage move for chase detection

# Scoring Configuration
RSI_DIVERGENCE_BONUS=10         # Bonus points for RSI divergence
REQUIRE_VOLUME_CONFIRMATION=true  # Require volume spike for ENTRY

# Price Action Configuration
PIVOT_WINDOW=5
ZONE_LOOKBACK=100
ZONE_TOLERANCE_PCT=0.5
VOLUME_SPIKE_THRESHOLD=1.5

# Zone-based SL/TP Configuration
ZONE_SL_BUFFER_PCT=0.2
MIN_ZONES_REQUIRED=2

# Application Settings
DRY_RUN=false
LOG_LEVEL=info
```

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

**Optional - Send to Group:**
- Add your bot to a Telegram group
- Get the group chat ID (usually starts with `-100`) from `/getUpdates`
- Add it to `.env` as `TELEGRAM_GROUP_ID`
- The bot will send signals to both private chat and group (duplicates are filtered)

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

### Signal Scoring System (0-110)

Signals are scored based on multiple factors:

| Factor | Max Points | Description | Required |
|--------|------------|-------------|----------|
| HTF Alignment | 30 | 1d & 4h structure alignment with signal direction | Yes |
| Setup Quality | 30 | Reversal patterns, true breakouts, retests | Yes |
| Candle Strength | 25 | Directional momentum of current candle | Yes |
| Volume Context | 15 | Volume spike and comparison to average | Yes |
| RSI Divergence | 10* | Bullish/bearish divergence confluence | Bonus |

**Score Thresholds:**
- **SETUP Alert**: 50+ points (early warning, heads-up)
- **ENTRY Signal**: 70+ points (confirmed, action-ready)
- **Configurable**: Can adjust thresholds via SETUP_SCORE_THRESHOLD and ENTRY_SCORE_THRESHOLD

*\*RSI divergence is a bonus, not required. Configurable via RSI_DIVERGENCE_BONUS (default: 10)*

### Two-Stage Alert System

**SETUP Stage (Intrabar Detection)**:
- Detects forming setups in real-time
- Lower score threshold (default 50)
- Early warning before candle close
- Allows preparation time
- Does not require HTF alignment

**ENTRY Stage (Confirmed)**:
- Only after clear trigger/confirmation
- Higher score threshold (default 70)
- Includes entry/SL/TP levels
- Requires HTF alignment
- Anti-chase logic applied
- Minimum R:R check (default 1.5)
- Optional volume confirmation

### Anti-Chase Logic

Prevents late entries by evaluating:

1. **Distance Checks**: Price movement vs ATR and percentage
2. **Volume Analysis**: Spike vs climax detection
3. **Momentum**: Consecutive candles and acceleration/slowdown
4. **Micro-Structure**: CHoCH (Change of Character) and BOS (Break of Structure)

**Chase Decisions**:
- `CHASE_NO`: Skip signal (too extended, likely trap)
- `CHASE_OK`: Allow entry (within acceptable range)
- `REVERSAL_WATCH`: Trend exhaustion (watch for reversal)

### Cooldown System

Prevents duplicate signals for the same setup:
- **Key**: `symbol_timeframe_side_zoneKey`
- **Default Duration**: 60 minutes (configurable)
- **Database**: Persistent across restarts

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

### Preview Telegram Messages

Preview the formatted message output without running the full bot:

```bash
node scripts/preview-telegram-message.js
```

This script generates sample signals (LONG and SHORT) to show how messages will appear in Telegram with your current configuration (including custom `SIGNAL_SOURCE_TEXT` if set).

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

### Backtesting

Run backtests to evaluate signal quality on historical data:

```bash
# Backtest single symbol, 30 days
node scripts/backtest.js --symbol BTCUSDT --timeframe 1h --period 30d


# Backtest multiple symbols, 7 days
node scripts/backtest.js --symbols BTCUSDT,ETHUSDT --timeframe 1h --period 7d

Signals are sent to Telegram with HTML formatting in a professional Vietnamese layout:

# Use .env configuration
node scripts/backtest.js --config --period 90d

# Save report to file
node scripts/backtest.js --symbol BTCUSDT --timeframe 1h --period 30d --output report.txt

# Detailed output with signal logs
node scripts/backtest.js --symbol BTCUSDT --timeframe 1h --period 7d --detailed
```


**Backtest Output:**
- Total signals generated
- Number of trades (wins/losses)
- Win rate percentage
- Average risk:reward ratio
- Expectancy (expected profit per trade)
- Total P&L

**Options:**
- `--symbol <SYMBOL>` - Single symbol to backtest
- `--symbols <SYMBOLS>` - Comma-separated list of symbols
- `--timeframe <TF>` - Timeframe (e.g., 1h, 4h)
- `--period <PERIOD>` - Period (e.g., 7d, 30d, 90d)
- `--start <DATE>` - Start date (YYYY-MM-DD)
- `--end <DATE>` - End date (YYYY-MM-DD)
- `--config` - Use symbols/timeframes from .env
- `--output <FILE>` - Save report to file
- `--min-score <N>` - Minimum signal score threshold
- `--detailed` - Show detailed signal logs

## Signal Format

### SETUP Alert (Early Warning)

```
⚠️ SETUP - CẢNH BÁO SỚM ⚠️
📈 Hướng: 🟢 MUA 📈
BTCUSDT | 1h

━━━ SETUP ĐANG HÌNH THÀNH ━━━
⏳ Setup: Bullish Reversal at Support
📊 Điểm: 55/100
💡 Entry dự kiến: ~43300.00
🛑 SL dự kiến: ~43100.00
🎯 TP1 dự kiến: ~43600.00

⚠️ Chờ xác nhận trước khi vào lệnh!

━━━ ĐỘ TIN CẬY ━━━
🟡 CAO 55/100 điểm
...
```

### ENTRY Signal (Confirmed)

```
📈 TÍN HIỆU 🟢 MUA 📈
BTCUSDT | 1h

━━━ KẾ HOẠCH GIAO DỊCH ━━━
Entry:  43300.00000000
SL:     43100.00000000
TP1:    43600.00000000 (1.5R) [kháng cự]
TP2:    43900.00000000 (3.0R) [kháng cự]

━━━ ĐỘ TIN CẬY ━━━
🟢 RẤT CAO 85/100 điểm

✅ Khung lớn: 1D 🟢 Tăng | 4H 🟢 Tăng

🟢 LONG | BTCUSDT | 4H
Đảo chiều
━━━━━━━━━━━━━━━━━━━━

📋 KẾ HOẠCH GIAO DỊCH
Entry: 42500.50000000
SL: 42000.00000000 (1.18%)
TP1: 43500.00000000 (2.35%) [2.0R]
TP2: 44500.00000000 (4.70%) [4.0R]
TP3: 45500.00000000 (7.06%) [6.0R]

Risk/Reward: 2R | WR: 65% | EV: 1.30

Điểm tín hiệu: 82/100

💡 Lý do vào kèo
✅ Xu hướng lớn TĂNG rõ ràng (1D tăng, 4H tăng)
✅ Mô hình nến Búa (Hammer) (độ mạnh 85%)
✅ Đảo chiều tại vùng hỗ trợ mạnh
✅ Volume CỰC MẠNH (2.3x TB) - tín hiệu rất tích cực
✅ Phân kỳ tăng - tín hiệu đảo chiều mạnh

━━━━━━━━━━━━━━━━━━━━
🕐 13:53 12/02/2026
📱 Posiya Tú zalo 0763888872
```

**Message Features:**
- **Header**: Side (🟢 LONG / 🔴 SHORT), symbol, timeframe, setup type in Vietnamese
- **Trade Plan**: Entry, SL, and up to 3 TPs with percentages and risk/reward ratios
- **Metrics**: RR (Risk/Reward), WR (Win Rate), EV (Expected Value) when available
- **Signal Score**: 0-100 score indicating signal quality
- **Reasons**: Vietnamese bullet points explaining the trade setup
- **Footer**: Timestamp and customizable source text (configurable via `SIGNAL_SOURCE_TEXT`)

✅ Anti-Chase: Good entry conditions

━━━ TẠI SAO VÀO KÈO ━━━
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
