const klinesCache = require('../binance/klinesCache');
const { analyzeMarketStructure, determineHTFBias, checkHTFAlignment } = require('../pa/structure');
const { detectSetup } = require('../pa/setups');
const { calculateScore, calculateLevels } = require('../pa/score');
const { detectRSIDivergence } = require('../indicators/rsi');
const { getRecentPivotHighs, getRecentPivotLows } = require('../pa/pivots');
const { isOnCooldown, addCooldown } = require('../store/cooldown');
const { saveSignal } = require('../store/signals');
const { sendSignal } = require('../notify/telegram');

/**
 * Main signal detection engine
 * Analyzes price action and generates trading signals
 */
class SignalEngine {
  constructor(config = {}) {
    this.config = {
      pivotWindow: parseInt(process.env.PIVOT_WINDOW) || 5,
      zoneLookback: parseInt(process.env.ZONE_LOOKBACK) || 100,
      zoneTolerance: parseFloat(process.env.ZONE_TOLERANCE_PCT) || 0.5,
      volumeSpikeThreshold: parseFloat(process.env.VOLUME_SPIKE_THRESHOLD) || 1.5,
      minScore: parseInt(process.env.MIN_SIGNAL_SCORE) || 70,
      cooldownMinutes: parseInt(process.env.SIGNAL_COOLDOWN_MINUTES) || 60,
      zoneSLBuffer: parseFloat(process.env.ZONE_SL_BUFFER_PCT) || 0.2,
      minZonesRequired: parseInt(process.env.MIN_ZONES_REQUIRED) || 2,
      ...config
    };

    console.log('[Engine] Signal engine initialized with config:', this.config);
  }

  /**
   * Analyze a symbol/timeframe and generate signal if detected
   * @param {string} symbol
   * @param {string} timeframe
   * @returns {Promise<Object|null>} Signal object or null
   */
  async analyzeSymbol(symbol, timeframe) {
    try {
      // Get candles from cache
      const candles = klinesCache.get(symbol, timeframe);
      
      if (!candles || candles.length < 100) {
        console.log(`[Engine] Insufficient data for ${symbol} ${timeframe}: ${candles ? candles.length : 0} candles`);
        return null;
      }

      // 1. Detect setup
      const setup = detectSetup(candles, this.config);
      
      if (!setup) {
        return null; // No setup detected
      }

      console.log(`[Engine] Setup detected: ${symbol} ${timeframe} - ${setup.name}`);

      // 2. Analyze HTF structure (1d and 4h)
      const htfBias = await this.getHTFBias(symbol);

      // 3. Check HTF alignment
      const htfAlignment = checkHTFAlignment(setup.side, htfBias);

      // 4. Detect RSI divergence
      const pivotHighs = getRecentPivotHighs(candles, this.config.pivotWindow, 10);
      const pivotLows = getRecentPivotLows(candles, this.config.pivotWindow, 10);
      const divergence = detectRSIDivergence(candles, pivotHighs, pivotLows);

      // 5. Calculate volume ratio
      const currentCandle = candles[candles.length - 1];
      const recentCandles = candles.slice(-20);
      const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
      const volumeRatio = currentCandle.volume / avgVolume;

      // 6. Calculate score
      const scoreResult = calculateScore(setup, htfAlignment, candles, divergence);

      console.log(`[Engine] Signal score: ${scoreResult.score}/${scoreResult.maxScore}`);
      console.log(`[Engine] Score breakdown:`, scoreResult.breakdown);

      // 7. Check if score meets threshold
      if (scoreResult.score < this.config.minScore) {
        console.log(`[Engine] Score too low (${scoreResult.score} < ${this.config.minScore}), skipping signal`);
        return null;
      }

      // 8. Calculate levels (entry, SL, TP) using zone-based approach
      const levels = calculateLevels(setup, this.config.zoneSLBuffer);

      // 9. Check cooldown
      const zoneKey = setup.zone ? setup.zone.key : 'none';
      if (isOnCooldown(symbol, timeframe, setup.side, zoneKey)) {
        console.log(`[Engine] Signal on cooldown: ${symbol} ${timeframe} ${setup.side} ${zoneKey}`);
        return null;
      }

      // 10. Build signal object
      const signal = {
        symbol,
        timeframe,
        side: setup.side,
        score: scoreResult.score,
        scoreBreakdown: scoreResult.breakdown,
        setup,
        htfBias,
        divergence,
        volumeRatio,
        levels,
        timestamp: currentCandle.closeTime,
        // For storage
        setup_type: setup.type,
        setup_name: setup.name,
        entry: levels.entry,
        stop_loss: levels.stopLoss,
        take_profit1: levels.takeProfit1,
        take_profit2: levels.takeProfit2,
        risk_reward: levels.riskReward1,
        zone_key: zoneKey
      };

      // 11. Send signal
      console.log(`[Engine] 🎯 SIGNAL GENERATED: ${symbol} ${timeframe} ${setup.side} @ ${levels.entry}`);
      
      const sent = await sendSignal(signal);

      if (sent) {
        // 12. Save to database
        saveSignal(signal);

        // 13. Add cooldown
        addCooldown(symbol, timeframe, setup.side, zoneKey, this.config.cooldownMinutes);

        return signal;
      } else {
        console.error(`[Engine] Failed to send signal for ${symbol} ${timeframe}`);
        return null;
      }

    } catch (err) {
      console.error(`[Engine] Error analyzing ${symbol} ${timeframe}:`, err.message);
      return null;
    }
  }

  /**
   * Get HTF bias from 1d and 4h structures
   * @param {string} symbol
   * @returns {Object} HTF bias object
   */
  async getHTFBias(symbol) {
    const structures = {};

    // Analyze 1d structure
    const candles1d = klinesCache.get(symbol, '1d');
    if (candles1d && candles1d.length >= 20) {
      structures['1d'] = analyzeMarketStructure(candles1d, this.config.pivotWindow);
    }

    // Analyze 4h structure
    const candles4h = klinesCache.get(symbol, '4h');
    if (candles4h && candles4h.length >= 20) {
      structures['4h'] = analyzeMarketStructure(candles4h, this.config.pivotWindow);
    }

    return determineHTFBias(structures);
  }

  /**
   * Handle new candle close event
   * @param {string} symbol
   * @param {string} timeframe
   * @param {Object} candle
   */
  async onCandleClosed(symbol, timeframe, candle) {
    console.log(`[Engine] Analyzing ${symbol} ${timeframe} on candle close...`);
    
    try {
      await this.analyzeSymbol(symbol, timeframe);
    } catch (err) {
      console.error(`[Engine] Error in onCandleClosed for ${symbol} ${timeframe}:`, err.message);
    }
  }
}

module.exports = SignalEngine;
