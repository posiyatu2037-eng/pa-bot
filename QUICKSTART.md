# PA-Bot Quick Start Guide

## Prerequisites
- Node.js v18+ installed
- Telegram account
- Internet connection for Binance data

## 5-Minute Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
nano .env  # Edit with your settings
```

**Minimum Required:**
- `SYMBOLS` - e.g., `BTCUSDT,ETHUSDT`
- `TELEGRAM_BOT_TOKEN` - Get from @BotFather on Telegram
- `TELEGRAM_CHAT_ID` - Your chat ID (see README for how to get it)

### 3. Test with Dry Run
```bash
DRY_RUN=true npm start
```

This will:
- Fetch historical data from Binance
- Connect to WebSocket for live updates
- Log signals to console (not send to Telegram)
- Allow you to verify everything works

### 4. Run for Real
```bash
npm start
```

Signals will now be sent to your Telegram!

## Quick Configuration Tips

### Conservative Settings (Fewer Signals, Higher Quality)
```env
MIN_SIGNAL_SCORE=80
SIGNAL_COOLDOWN_MINUTES=120
TIMEFRAMES=1d,4h,1h
```

### Aggressive Settings (More Signals - Add Lower Timeframes)
```env
MIN_SIGNAL_SCORE=65
SIGNAL_COOLDOWN_MINUTES=30
TIMEFRAMES=1d,4h,1h,15m
```

### Gold Trading (XAUUSD)
```env
SYMBOLS=XAUUSD,BTCUSDT
# XAUUSD automatically maps to XAUUSDT on Binance
```

## Monitoring

### Check Logs
```bash
# If running with npm start
# Logs appear in console

# If running with PM2
pm2 logs pa-bot

# If running with systemd
sudo journalctl -u pa-bot -f
```

### Database Stats
```bash
sqlite3 data/signals.db "SELECT COUNT(*) FROM signals;"
sqlite3 data/signals.db "SELECT symbol, COUNT(*) FROM signals GROUP BY symbol;"
```

## Troubleshooting

### No Signals?
1. Check `MIN_SIGNAL_SCORE` - try lowering it
2. Enable `DRY_RUN=true` to see if any signals are detected
3. Check logs for "Setup detected" messages
4. Market conditions may not meet criteria (this is normal)

### WebSocket Disconnects?
- Automatic reconnection is built-in
- Check internet connection
- Check Binance API status

### Telegram Not Working?
1. Verify bot token is correct
2. Ensure you've started the bot (send /start)
3. Verify chat ID is correct
4. Test with `DRY_RUN=true` first

## Production Deployment

### Using PM2 (Recommended)
```bash
npm install -g pm2
pm2 start src/index.js --name pa-bot
pm2 save
pm2 startup
```

### Using systemd
```bash
sudo cp deploy/pa-bot.service /etc/systemd/system/
sudo systemctl enable pa-bot
sudo systemctl start pa-bot
```

## Signal Types You'll See

1. **Reversals** - Price bounces from support/resistance
2. **Breakouts** - Price breaks through key levels with volume
3. **Retests** - Price tests broken levels
4. **False Breakouts** - Fake breakouts to fade

## Understanding the Score

Each signal is scored 0-100 based on:
- **HTF Alignment** (30pts) - Are higher timeframes aligned?
- **Setup Quality** (25pts) - How clean is the setup?
- **Candle Strength** (20pts) - How strong is the move?
- **Volume** (15pts) - Is volume confirming?
- **RSI Divergence** (10pts) - Is there divergence?

Default minimum: 70/100

## Important Notes

⚠️ **This bot does NOT trade automatically**
- Signals are for information only
- You must manually enter trades
- Always use proper risk management
- Never risk more than you can afford to lose

## Support

- Issues: https://github.com/posiyatu2037-eng/pa-bot/issues
- Full docs: See README.md
