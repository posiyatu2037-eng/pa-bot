const klinesCache = require('../binance/klinesCache');
const { analyzeMarketStructure, determineHTFBias, checkHTFAlignment } = require('../pa/structure');
const { detectSetup } = require('../pa/setups');
const { calculateScore, calculateLevels } = require('../pa/score');
const { detectRSIDivergence } = require('../indicators/rsi');
const { getRecentPivotHighs, getRecentPivotLows } = require('../pa/pivots');
const { isOnCooldown, addCooldown } = require('../store/cooldown');
const { saveSignal } = require('../store/signals');
const { sendSignal } = require('../notify/telegram');
const { detectMarketRegime } = require('../pa/regime');
const { detectStructureEvents } = require('../pa/events');
const { detectRecentSweep } = require('../pa/liquidity');

/**
 * Main signal detection engine
 * Analyzes price action and generates trading signals
 */
class SignalEngine {
  constructor(config = {}) {
    // Get signal mode from env (pro or aggressive)
    const signalMode = (process.env.SIGNAL_MODE || 'pro').toLowerCase();
    
    // Parse env vars once
    const minScoreEnv = parseInt(process.env.MIN_SIGNAL_SCORE);
    const cooldownEnv = parseInt(process.env.SIGNAL_COOLDOWN_MINUTES);
    const minZonesEnv = parseInt(process.env.MIN_ZONES_REQUIRED);
    
    // Base configuration
    const baseConfig = {
      pivotWindow: parseInt(process.env.PIVOT_WINDOW) || 5,
      zoneLookback: parseInt(process.env.ZONE_LOOKBACK) || 100,
      zoneTolerance: parseFloat(process.env.ZONE_TOLERANCE_PCT) || 0.5,
      volumeSpikeThreshold: parseFloat(process.env.VOLUME_SPIKE_THRESHOLD) || 1.5,
      zoneSLBuffer: parseFloat(process.env.ZONE_SL_BUFFER_PCT) || 0.2,
      atrPeriod: parseInt(process.env.ATR_PERIOD) || 14,
      sweepLookback: parseInt(process.env.SWEEP_LOOKBACK) || 5,
      structureLookback: parseInt(process.env.STRUCTURE_LOOKBACK) || 3,
      signalMode: signalMode
    };
    
    // Apply mode-specific defaults
    if (signalMode === 'aggressive') {
      this.config = {
        ...baseConfig,
        minScore: minScoreEnv >= 0 ? minScoreEnv : 50,
        cooldownMinutes: cooldownEnv >= 0 ? cooldownEnv : 30,
        minZonesRequired: minZonesEnv >= 0 ? minZonesEnv : 0,
        ...config
      };
    } else {
      // pro mode (default)
      this.config = {
        ...baseConfig,
        minScore: minScoreEnv >= 0 ? minScoreEnv : 70,
        cooldownMinutes: cooldownEnv >= 0 ? cooldownEnv : 60,
        minZonesRequired: minZonesEnv >= 0 ? minZonesEnv : 2,
        ...config
      };
    }

    console.log(`[Engine] Signal engine initialized in ${signalMode.toUpperCase()} mode`);
    console.log('[Engine] Config:', this.config);
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
        console.log(`[Skip] ${symbol} ${timeframe}: reason=insufficient_data, details=${candles ? candles.length : 0} candles available`);
        return null;
      }

      // 1. Detect setup
      const setup = detectSetup(candles, this.config);
      
      if (!setup) {
        return null; // No setup detected (not logged as skip since it's normal)
      }

      console.log(`[Engine] Setup detected: ${symbol} ${timeframe} - ${setup.name}`);

      // 2. Detect market regime
      const pivotHighs = getRecentPivotHighs(candles, this.config.pivotWindow, 10);
      const pivotLows = getRecentPivotLows(candles, this.config.pivotWindow, 10);
      const regime = detectMarketRegime(candles, pivotHighs, pivotLows, {
        atrPeriod: this.config.atrPeriod
      });

      // 3. Analyze HTF structure (1d and 4h)
      const htfBias = await this.getHTFBias(symbol);

      // 4. Check HTF alignment
      const htfAlignment = checkHTFAlignment(setup.side, htfBias);

      // 5. Detect structure events (BOS/CHoCH)
      const currentTrend = htfBias.structures['4h'] || 'neutral';
      const structureEvent = detectStructureEvents(
        candles, 
        pivotHighs, 
        pivotLows, 
        currentTrend, 
        this.config.structureLookback
      );

      // 6. Detect liquidity sweep
      const sweep = detectRecentSweep(
        candles, 
        pivotHighs, 
        pivotLows, 
        setup.zones, 
        this.config.sweepLookback
      );

      // 7. Detect RSI divergence
      const divergence = detectRSIDivergence(candles, pivotHighs, pivotLows);

      // 8. Calculate volume ratio
      const currentCandle = candles[candles.length - 1];
      const recentCandles = candles.slice(-20);
      const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
      const volumeRatio = currentCandle.volume / avgVolume;

      // 9. Calculate score
      const scoreResult = calculateScore(setup, htfAlignment, candles, divergence);

      console.log(`[Engine] Signal score: ${scoreResult.score}/${scoreResult.maxScore}`);
      console.log(`[Engine] Score breakdown:`, scoreResult.breakdown);

      // 10. Check if score meets threshold (configurable)
      if (this.config.minScore > 0 && scoreResult.score < this.config.minScore) {
        console.log(`[Skip] ${symbol} ${timeframe}: reason=score_too_low, details=score=${scoreResult.score}, threshold=${this.config.minScore}, mode=${this.config.signalMode}`);
        return null;
      }

      // 11. Calculate levels (entry, SL, TP) using zone-based approach
      const levels = calculateLevels(setup, this.config.zoneSLBuffer);

      // Validate levels are not NaN or Infinity
      if (!levels || 
          !isFinite(levels.entry) || 
          !isFinite(levels.stopLoss) || 
          !isFinite(levels.takeProfit1)) {
        console.log(`[Skip] ${symbol} ${timeframe}: reason=invalid_levels, details=NaN or Infinity in calculated levels`);
        return null;
      }

      // 12. Check cooldown (configurable)
      const zoneKey = setup.zone ? setup.zone.key : 'none';
      if (this.config.cooldownMinutes > 0 && isOnCooldown(symbol, timeframe, setup.side, zoneKey)) {
        console.log(`[Skip] ${symbol} ${timeframe}: reason=cooldown_active, details=side=${setup.side}, zone=${zoneKey}, cooldown=${this.config.cooldownMinutes}min`);
        return null;
      }

      // 13. Build signal object
      const signal = {
        symbol,
        timeframe,
        side: setup.side,
        score: scoreResult.score,
        scoreBreakdown: scoreResult.breakdown,
        setup,
        htfBias,
        regime,
        structureEvent,
        sweep,
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

      // 14. Send signal
      console.log(`[Engine] 🎯 SIGNAL GENERATED: ${symbol} ${timeframe} ${setup.side} @ ${levels.entry}`);
      
      const sent = await sendSignal(signal);

      if (sent) {
        // 15. Save to database
        saveSignal(signal);

        // 16. Add cooldown (if enabled)
        if (this.config.cooldownMinutes > 0) {
          addCooldown(symbol, timeframe, setup.side, zoneKey, this.config.cooldownMinutes);
        }

        return signal;
      } else {
        console.error(`[Engine] Failed to send signal for ${symbol} ${timeframe}`);
        return null;
      }

    } catch (err) {
      console.error(`[Engine] Error analyzing ${symbol} ${timeframe}:`, err.message);
      console.error(err.stack);
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
