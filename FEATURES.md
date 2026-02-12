# PA-Bot Feature Documentation

## Core Features

### 1. Multi-Timeframe Analysis
- **Supported Timeframes**: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 12h, 1d, 3d, 1w
- **Default Pro-Grade Mode**: 1d, 4h, 1h (optimized for higher-quality setups)
  - **1d**: Higher timeframe bias determination
  - **4h & 1h**: Primary analysis and entry timeframes
  - **15m removed**: Focusing on higher timeframes reduces noise and improves signal quality
- **HTF Bias**: Automatically analyzes 1d and 4h for trend direction
- **Alignment Scoring**: Rewards signals that align with higher timeframes

### 2. Price Action Engine

#### Pivot Detection
- Swing high/low detection with configurable window (default: 5)
- Used for structure analysis and zone building
- Identifies key reversal points

#### Market Structure
- **Up Structure**: Higher highs + higher lows
- **Down Structure**: Lower highs + lower lows
- **Neutral Structure**: Mixed or ranging
- Analyzes both 1d and 4h for HTF bias

#### Support/Resistance Zones
- Built from pivot highs (resistance) and lows (support)
- Configurable lookback period (default: 100 candles)
- Zone merging to reduce noise
- Touch/retest detection
- Tolerance-based proximity (default: 0.5%)
- **Minimum zones validation**: Signals require sufficient zones (default: 2 minimum)
- **Zone-based SL/TP**: Stop loss and take profit levels derived from actual support/resistance zones

#### Candlestick Patterns (Enhanced Pro-Grade Analysis)
- **Pin Bar/Hammer**: Bullish reversal (long lower wick)
- **Shooting Star**: Bearish reversal (long upper wick)
- **Engulfing**: Two-candle reversal pattern
- **Doji**: Indecision candle
- **Tweezer Top/Bottom**: Double top/bottom reversal patterns
- **Morning/Evening Star**: Three-candle reversal formations
- **Inside Bar**: Consolidation pattern signaling potential breakout
- **2-Bar Reversal**: Key reversal after making new high/low
- Pattern strength calculation
- **Advanced Candle Analysis**:
  - Body vs wick ratio analysis
  - Close location within range (0-1 scale)
  - Rejection strength quantification
  - Upper/lower wick percentage measurement

#### Market Regime Detection
- **Trend Detection**: Identifies uptrend, downtrend using swing structure
- **Range Detection**: Identifies sideways/consolidation periods
- **Expansion Detection**: Detects high volatility periods using ATR
- **ATR-Based Volatility**: Compares current ATR to historical ATR
- **Slope Analysis**: Linear regression slope to confirm trend strength
- **Confidence Score**: 0-1 score indicating regime confidence
- Configurable ATR period (default: 14)

#### Structure Events (SMC/ICT Style)
- **BOS (Break of Structure)**: Detects trend continuation when price breaks last swing high (uptrend) or low (downtrend)
- **CHoCH (Change of Character)**: Detects trend reversal when price breaks last swing low (uptrend) or high (downtrend)
- Configurable structure lookback (default: 3 pivots)
- Strength calculation based on breakout magnitude
- Real-time event detection on candle close

#### Liquidity Sweep Detection
- **Swing High Sweep**: Wick above recent high, close back below (bearish)
- **Swing Low Sweep**: Wick below recent low, close back above (bullish)
- **Zone Boundary Sweep**: Sweeps of support/resistance zone boundaries
- Stop hunt identification for reversal opportunities
- Configurable sweep lookback (default: 5 recent swings)
- Strength calculation based on wick size and close distance

### 3. Setup Detection

#### Reversal Setups
- At support with bullish pattern → LONG
- At resistance with bearish pattern → SHORT
- Requires pattern + zone proximity
- Best with HTF alignment

#### Breakout Setups
- **True Breakout**: Close beyond zone + volume spike → LONG/SHORT
- **False Breakout**: Wick beyond but close inside + weak volume → FADE
- Volume confirmation critical

#### Breakdown Setups
- **True Breakdown**: Break support + volume → SHORT
- **False Breakdown**: Sweep but close inside → LONG (fade)

#### Retest Setups
- After breakout, price retests broken level
- Former resistance becomes support (LONG)
- Former support becomes resistance (SHORT)
- Requires pattern confirmation

#### Zone Validation (Configurable)
- Configurable minimum zones required (default: 2, set to 0 to disable)
- If `MIN_ZONES_REQUIRED <= 0`, allows signals without zones using fallback RR levels
- Explicit structured logging when signals are skipped: `[Skip] <symbol> <tf>: reason=... details=...`
- Ensures transparency when filters reject signals

#### Setup Context Priority
- **Context**: Market regime + HTF bias analyzed first
- **Trigger**: Liquidity sweep + structure events + confirmation candle
- **Validation**: Pattern strength + volume confirmation
- Multi-layered approach ensures high-quality setups

### 4. Signal Filtering & Modes

#### Signal Modes
- **Pro Mode** (default): Strict filters for high-quality signals
  - Minimum score: 70
  - Minimum zones: 2
  - Cooldown: 60 minutes
- **Aggressive Mode**: Relaxed filters for more signals
  - Minimum score: 50
  - Minimum zones: 0
  - Cooldown: 30 minutes

#### Configurable Filters
- **Score Threshold**: Set `MIN_SIGNAL_SCORE <= 0` to disable
- **Zone Requirement**: Set `MIN_ZONES_REQUIRED <= 0` to allow signals without zones
- **Cooldown**: Set `SIGNAL_COOLDOWN_MINUTES <= 0` to disable
- All filters log structured skip messages when they reject signals

### 5. Zone-Based SL/TP System

#### Stop Loss Calculation
- **LONG**: Finds nearest support zone below entry
  - Places SL below the support zone with configurable buffer (default: 0.2%)
  - Fallback to setup zone if no lower support found
- **SHORT**: Finds nearest resistance zone above entry
  - Places SL above the resistance zone with buffer
  - Fallback to setup zone if no higher resistance found

#### Take Profit Calculation
- **LONG**: Finds next resistance zones above entry
  - TP1: First resistance zone center
  - TP2: Second resistance zone center (if available)
  - Fallback to RR-based if insufficient zones
- **SHORT**: Finds next support zones below entry
  - TP1: First support zone center
  - TP2: Second support zone center (if available)
  - Fallback to RR-based if insufficient zones

#### Benefits
- Aligns with natural market structure
- Takes profit at logical resistance/support
- Reduces arbitrary percentage-based levels
- Improves risk/reward by targeting real price levels
- Telegram messages indicate zone-based targets with `[support]` or `[resistance]` labels

### 5. Volume Analysis
- Average volume calculation (20-period default)
- Volume spike detection (>1.5x average by default)
- Volume ratio included in signals
- Critical for breakout validation

### 6. Technical Indicators

#### RSI (Relative Strength Index)
- 14-period default
- Calculated using smoothed averages
- Used for divergence detection

#### Divergence Detection
- **Bullish**: Price makes lower low, RSI makes higher low
- **Bearish**: Price makes higher high, RSI makes lower high
- Requires minimum 2 pivot points
- Adds 10 points to signal score

### 7. Signal Scoring System

**Total: 100 Points**

1. **HTF Alignment (30 pts)**
   - Perfect alignment (1d + 4h same direction): 25-30 pts
   - Partial alignment: 10-20 pts
   - No alignment: 5-15 pts

2. **Setup Quality (25 pts)**
   - Reversal at key level: 10-25 pts
   - True breakout: 12-25 pts
   - Retest: 10-23 pts
   - False breakout fade: 8-23 pts

3. **Candle Strength (20 pts)**
   - Strong directional candle: 15-20 pts
   - Close location bonus: +2 pts (upper 30% for longs, lower 30% for shorts)
   - Rejection strength bonus: +3 pts (downside rejection for longs, upside for shorts)
   - Weak/opposite: 5-10 pts

4. **Volume Context (15 pts)**
   - >2x average: 15 pts
   - >1.5x average: 12 pts
   - >1.2x average: 10 pts
   - <0.8x average: 5 pts

5. **RSI Divergence (10 pts)**
   - Aligned divergence: 10 pts
   - No divergence: 0 pts

**Default Minimum**: 70/100

### 8. Cooldown & Deduplication

#### Cooldown Key
Format: `{symbol}_{timeframe}_{side}_{zoneKey}`

Example: `BTCUSDT_1h_LONG_support_43000`

#### Features
- Prevents duplicate signals for same setup
- Configurable duration (default: 60 minutes)
- Persistent across restarts (SQLite)
- Per-zone tracking
- Automatic cleanup of expired cooldowns

### 9. Data Management

#### Binance Integration
- **REST API**: Initial historical data fetch (500 candles)
- **WebSocket**: Real-time kline updates
- Combined streams for efficiency
- Auto-reconnect with exponential backoff (1s → 60s)
- Ping/pong keep-alive (30s interval)

#### Klines Cache
- In-memory storage organized by symbol/timeframe
- Automatic updates on candle close
- Size limit: 1000 candles per pair
- Fast access for analysis

#### Symbol Validation
- Fetches exchangeInfo at startup
- Validates TRADING status
- XAUUSD → XAUUSDT mapping
- Filters invalid symbols

### 10. Database (SQLite)

#### Signals Table
Stores all sent signals with:
- Symbol, timeframe, side
- Setup type and name
- Score and score breakdown
- Entry, SL, TP1, TP2, RR
- Zone key
- Timestamps

#### Cooldowns Table
Tracks active cooldowns:
- Cooldown key (unique)
- Symbol, timeframe, side, zone
- Expiration timestamp
- Creation timestamp

#### Features
- WAL mode for performance
- Indexed for fast queries
- Automatic schema creation
- Signal history tracking
- Statistics queries

### 11. Telegram Integration

#### Message Format
- Markdown V2 with proper escaping
- Monospace tables for structured data
- Emoji indicators (🚨, ✅, 📍, 📊, 📈)
- HTF bias display
- Setup and zone information
- Entry/SL/TP levels with R:R
- Volume analysis
- RSI divergence (when present)
- Bullet-point reasons
- Timestamp
- Customizable footer

#### Features
- DRY_RUN mode for testing
- Error handling and logging
- Connection testing
- Simple text messages for notifications

### 12. Configuration

#### Environment Variables
All aspects configurable via .env:
- Symbols and timeframes
- Score thresholds
- Cooldown periods
- Pivot window
- Zone parameters (lookback, tolerance)
- **Zone SL/TP settings**:
  - `ZONE_SL_BUFFER_PCT`: Buffer beyond zones for stop loss (default: 0.2%)
  - `MIN_ZONES_REQUIRED`: Minimum zones needed for signal generation (default: 2)
- Volume thresholds
- Database path
- Telegram credentials
- DRY_RUN mode

#### Preset Modes
- **Conservative**: High score threshold, longer cooldown
- **Aggressive**: Lower threshold, shorter cooldown
- **Balanced**: Default settings

### 13. Operational Features

#### Startup
- Environment validation
- Database initialization
- Symbol validation
- Historical data fetch
- WebSocket connection
- Telegram notification

#### Runtime
- Event-driven architecture
- Minimal CPU usage
- ~50-100MB memory
- Automatic error recovery
- Graceful shutdown (SIGINT/SIGTERM)

#### Monitoring
- Console logging (configurable level)
- Database statistics
- Signal history
- Cooldown tracking

### 14. Deployment Options

#### Development
- Direct Node.js execution
- DRY_RUN for testing
- Console output

#### Production
- **PM2**: Process management, auto-restart
- **systemd**: System service integration
- Log management
- Auto-start on boot

### 15. Security & Safety

#### No Trading Execution
- Alerts only - no automatic trades
- No Binance API keys required
- No order placement capability

#### Data Security
- Environment variables for secrets
- .gitignore for sensitive files
- Local database only
- No external data sharing

### 15. Performance Optimizations

#### Efficient Analysis
- Cached klines data
- On-close analysis only
- Minimal recalculations
- Event-driven (not polling)

#### Network
- WebSocket for real-time data
- REST only for initial fetch
- Rate limit awareness
- Connection pooling

#### Database
- WAL mode
- Indexed queries
- Prepared statements
- Efficient schema

## Use Cases

### Day Trading
- 15m, 5m timeframes
- Lower score threshold (65-70)
- Shorter cooldown (30-45 min)

### Swing Trading
- 4h, 1h, 1d timeframes
- Higher score threshold (75-85)
- Longer cooldown (120-240 min)

### Multi-Symbol Monitoring
- Monitor 5-10 symbols
- 1d, 4h, 1h timeframes
- Medium threshold (70-75)

### Specific Pairs
- BTCUSDT, ETHUSDT, BNBUSDT
- All major crypto pairs
- Gold (XAUUSD/XAUUSDT)

## Limitations

1. **Market Conditions**: Signals depend on specific conditions being met
2. **No Guarantees**: Past patterns don't guarantee future results
3. **Internet Required**: Needs stable connection to Binance
4. **Telegram Required**: For notifications (can use DRY_RUN otherwise)
5. **Historical Data**: Needs sufficient data (100+ candles)
6. **False Signals**: No system is perfect - use with risk management

## Future Enhancements (Not Implemented)

Potential additions users might consider:
- Multiple Telegram channels/chats
- Web dashboard for monitoring
- Backtesting framework
- Additional indicators (MACD, Bollinger Bands)
- Pattern success tracking
- Risk/money management calculator
- Trade journal integration
- Alert filtering by time of day
- Custom scoring weights
- Machine learning score optimization

## Technical Stack

- **Runtime**: Node.js 18+
- **Database**: SQLite with better-sqlite3
- **WebSocket**: ws library
- **Telegram**: node-telegram-bot-api
- **Retry Logic**: p-retry
- **Config**: dotenv

## Code Architecture

```
src/
├── app/          # Core engine
├── binance/      # Data providers
├── indicators/   # Technical indicators
├── pa/           # Price action modules
├── store/        # Data persistence
└── notify/       # Notifications
```

Clean separation of concerns, modular design, easy to extend.
