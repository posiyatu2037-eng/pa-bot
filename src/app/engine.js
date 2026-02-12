const klinesCache = require('../binance/klinesCache');
const { analyzeMarketStructure, determineHTFBias, checkHTFAlignment } = require('../pa/structure');
const { detectSetup } = require('../pa/setups');
const { calculateScore, calculateLevels } = require('../pa/score');
const { detectRSIDivergence } = require('../indicators/rsi');
const { getRecentPivotHighs, getRecentPivotLows } = require('../pa/pivots');
const { isOnCooldown, addCooldown } = require('../store/cooldown');
const { saveSignal } = require('../store/signals');
const { sendSignal } = require('../notify/telegram');
const { evaluateChaseRisk } = require('../pa/antiChase');

/**
 * Main signal detection engine
 * Analyzes price action and generates trading signals
 * Supports two-stage alerts: SETUP (early warning) and ENTRY (confirmed)
 */
class SignalEngine {
  constructor(config = {}) {
    // Parse stage configuration
    const stagesEnabled = (process.env.SIGNAL_STAGE_ENABLED || 'setup,entry')
      .split(',')
      .map(s => s.trim().toLowerCase());

    // Parse timeframe configuration
    const entryTimeframes = (process.env.ENTRY_TIMEFRAMES || '1h')
      .split(',')
      .map(tf => tf.trim());
    
    const htfTimeframes = (process.env.HTF_TIMEFRAMES || '4h,1d')
      .split(',')
      .map(tf => tf.trim());

    this.config = {
      pivotWindow: parseInt(process.env.PIVOT_WINDOW) || 5,
      zoneLookback: parseInt(process.env.ZONE_LOOKBACK) || 100,
      zoneTolerance: parseFloat(process.env.ZONE_TOLERANCE_PCT) || 0.5,
      volumeSpikeThreshold: parseFloat(process.env.VOLUME_SPIKE_THRESHOLD) || 1.5,
      minScore: parseInt(process.env.MIN_SIGNAL_SCORE) || 70, // Legacy, kept for backwards compatibility
      setupScoreThreshold: parseInt(process.env.SETUP_SCORE_THRESHOLD) || 50,
      entryScoreThreshold: parseInt(process.env.ENTRY_SCORE_THRESHOLD) || 70,
      cooldownMinutes: parseInt(process.env.SIGNAL_COOLDOWN_MINUTES) || 60,
      zoneSLBuffer: parseFloat(process.env.ZONE_SL_BUFFER_PCT) || 0.2,
      minZonesRequired: parseInt(process.env.MIN_ZONES_REQUIRED) || 2,
      minRR: parseFloat(process.env.MIN_RR) || 1.5,
      antiChaseMaxATR: parseFloat(process.env.ANTI_CHASE_MAX_ATR) || 2.0,
      antiChaseMaxPct: parseFloat(process.env.ANTI_CHASE_MAX_PCT) || 3.0,
      rsiDivergenceBonus: parseInt(process.env.RSI_DIVERGENCE_BONUS) || 10,
      requireVolumeConfirmation: (process.env.REQUIRE_VOLUME_CONFIRMATION || 'true') === 'true',
      setupStageEnabled: stagesEnabled.includes('setup'),
      entryStageEnabled: stagesEnabled.includes('entry'),
      entryTimeframes,
      htfTimeframes,
      ...config
    };

    // Track which setups have been alerted at SETUP stage
    this.setupAlerts = new Map(); // Key: symbol_tf_side_zoneKey

    console.log('[Engine] Signal engine initialized with config:', this.config);
  }

  /**
   * Analyze a symbol/timeframe for ENTRY signals (confirmed, action-ready)
   * @param {string} symbol
   * @param {string} timeframe
   * @param {boolean} isIntrabar - Whether this is an intrabar update
   * @returns {Promise<Object|null>} Signal object or null
   */
  async analyzeForEntry(symbol, timeframe, isIntrabar = false) {
    if (!this.config.entryStageEnabled) {
      return null; // ENTRY stage disabled
    }

    try {
      // Get candles from cache (closed candles only for ENTRY)
      const candles = klinesCache.get(symbol, timeframe);
      
      if (!candles || candles.length < 100) {
        return null;
      }

      // 1. Detect setup
      const setup = detectSetup(candles, this.config);
      
      if (!setup) {
        return null; // No setup detected
      }

      console.log(`[Engine] ENTRY: Setup detected: ${symbol} ${timeframe} - ${setup.name}`);

      // 2. Analyze HTF structure
      const htfBias = await this.getHTFBias(symbol);

      // 3. Check HTF alignment
      const htfAlignment = checkHTFAlignment(setup.side, htfBias);

      // Check if HTF is aligned - ENTRY requires HTF alignment
      if (!htfAlignment.aligned) {
        console.log(`[Engine] ENTRY: HTF not aligned for ${symbol} ${timeframe}, skipping ENTRY`);
        return null;
      }

      // 4. Detect RSI divergence (bonus)
      const pivotHighs = getRecentPivotHighs(candles, this.config.pivotWindow, 10);
      const pivotLows = getRecentPivotLows(candles, this.config.pivotWindow, 10);
      const divergence = detectRSIDivergence(candles, pivotHighs, pivotLows);

      // 5. Calculate volume ratio
      const currentCandle = candles[candles.length - 1];
      const recentCandles = candles.slice(-20);
      const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
      const volumeRatio = currentCandle.volume / avgVolume;

      // Volume confirmation check
      if (this.config.requireVolumeConfirmation && volumeRatio < this.config.volumeSpikeThreshold) {
        console.log(`[Engine] ENTRY: Insufficient volume (${volumeRatio.toFixed(2)}x < ${this.config.volumeSpikeThreshold}x), skipping`);
        return null;
      }

      // 6. Calculate score
      const scoreResult = calculateScore(setup, htfAlignment, candles, divergence, this.config);

      console.log(`[Engine] ENTRY: Signal score: ${scoreResult.score}/${scoreResult.maxScore}`);
      console.log(`[Engine] ENTRY: Score breakdown:`, scoreResult.breakdown);

      // 7. Check if score meets ENTRY threshold
      if (scoreResult.score < this.config.entryScoreThreshold) {
        console.log(`[Engine] ENTRY: Score too low (${scoreResult.score} < ${this.config.entryScoreThreshold}), skipping`);
        return null;
      }

      // 8. Calculate levels (entry, SL, TP) using zone-based approach
      const levels = calculateLevels(setup, this.config.zoneSLBuffer);

      // 9. Check minimum R:R
      if (levels.riskReward1 < this.config.minRR) {
        console.log(`[Engine] ENTRY: R:R too low (${levels.riskReward1.toFixed(2)} < ${this.config.minRR}), skipping`);
        return null;
      }

      // 10. Anti-chase evaluation
      const chaseEval = evaluateChaseRisk(candles, setup, this.config);
      console.log(`[Engine] ENTRY: Anti-chase decision: ${chaseEval.decision} (score: ${chaseEval.score}) - ${chaseEval.reason}`);

      if (chaseEval.decision === 'CHASE_NO') {
        console.log(`[Engine] ENTRY: Anti-chase rejected signal`);
        return null;
      }

      // 11. Check cooldown
      const zoneKey = setup.zone ? setup.zone.key : 'none';
      if (isOnCooldown(symbol, timeframe, setup.side, zoneKey)) {
        console.log(`[Engine] ENTRY: Signal on cooldown: ${symbol} ${timeframe} ${setup.side} ${zoneKey}`);
        return null;
      }

      // 12. Build signal object
      const signal = {
        stage: 'ENTRY',
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
        chaseEval,
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

      // 13. Send signal
      console.log(`[Engine] 🎯 ENTRY SIGNAL: ${symbol} ${timeframe} ${setup.side} @ ${levels.entry}`);
      
      const sent = await sendSignal(signal);

      if (sent) {
        // 14. Save to database
        saveSignal(signal);

        // 15. Add cooldown
        addCooldown(symbol, timeframe, setup.side, zoneKey, this.config.cooldownMinutes);

        return signal;
      } else {
        console.error(`[Engine] ENTRY: Failed to send signal for ${symbol} ${timeframe}`);
        return null;
      }

    } catch (err) {
      console.error(`[Engine] ENTRY: Error analyzing ${symbol} ${timeframe}:`, err.message);
      return null;
    }
  }

  /**
   * Analyze a symbol/timeframe for SETUP signals (early warning, heads-up)
   * @param {string} symbol
   * @param {string} timeframe
   * @returns {Promise<Object|null>} Signal object or null
   */
  async analyzeForSetup(symbol, timeframe) {
    if (!this.config.setupStageEnabled) {
      return null; // SETUP stage disabled
    }

    try {
      // Get candles including forming candle for intrabar detection
      const candles = klinesCache.getWithForming(symbol, timeframe);
      
      if (!candles || candles.length < 100) {
        return null;
      }

      // 1. Detect setup
      const setup = detectSetup(candles, this.config);
      
      if (!setup) {
        return null; // No setup detected
      }

      // 2. Check if we already alerted for this setup
      const zoneKey = setup.zone ? setup.zone.key : 'none';
      const setupKey = `${symbol}_${timeframe}_${setup.side}_${zoneKey}`;
      
      if (this.setupAlerts.has(setupKey)) {
        // Already alerted for this setup, skip
        return null;
      }

      console.log(`[Engine] SETUP: Setup detected: ${symbol} ${timeframe} - ${setup.name}`);

      // 3. Analyze HTF structure
      const htfBias = await this.getHTFBias(symbol);

      // 4. Check HTF alignment (not required for SETUP, but informative)
      const htfAlignment = checkHTFAlignment(setup.side, htfBias);

      // 5. Calculate score
      const scoreResult = calculateScore(setup, htfAlignment, candles, null, this.config);

      console.log(`[Engine] SETUP: Signal score: ${scoreResult.score}/${scoreResult.maxScore}`);

      // 6. Check if score meets SETUP threshold
      if (scoreResult.score < this.config.setupScoreThreshold) {
        console.log(`[Engine] SETUP: Score too low (${scoreResult.score} < ${this.config.setupScoreThreshold}), skipping`);
        return null;
      }

      // 7. Calculate approximate levels (for info only)
      const levels = calculateLevels(setup, this.config.zoneSLBuffer);

      // 8. Build signal object
      const currentCandle = candles[candles.length - 1];
      const signal = {
        stage: 'SETUP',
        symbol,
        timeframe,
        side: setup.side,
        score: scoreResult.score,
        scoreBreakdown: scoreResult.breakdown,
        setup,
        htfBias,
        levels,
        timestamp: currentCandle.closeTime,
        setup_type: setup.type,
        setup_name: setup.name,
        zone_key: zoneKey
      };

      // 9. Send signal
      console.log(`[Engine] ⚠️ SETUP SIGNAL: ${symbol} ${timeframe} ${setup.side} - ${setup.name}`);
      
      const sent = await sendSignal(signal);

      if (sent) {
        // 10. Mark this setup as alerted
        this.setupAlerts.set(setupKey, Date.now());
        
        // Clean up old setup alerts (older than cooldown period)
        this.cleanupSetupAlerts();

        return signal;
      } else {
        console.error(`[Engine] SETUP: Failed to send signal for ${symbol} ${timeframe}`);
        return null;
      }

    } catch (err) {
      console.error(`[Engine] SETUP: Error analyzing ${symbol} ${timeframe}:`, err.message);
      return null;
    }
  }

  /**
   * Clean up old setup alerts
   */
  cleanupSetupAlerts() {
    const now = Date.now();
    const maxAge = this.config.cooldownMinutes * 60 * 1000;
    
    for (const [key, timestamp] of this.setupAlerts.entries()) {
      if (now - timestamp > maxAge) {
        this.setupAlerts.delete(key);
      }
    }
  }

  /**
   * Get HTF bias from configured HTF timeframes
   * @param {string} symbol
   * @returns {Object} HTF bias object
   */
  async getHTFBias(symbol) {
    const structures = {};

    // Analyze HTF timeframes
    for (const tf of this.config.htfTimeframes) {
      const candles = klinesCache.get(symbol, tf);
      if (candles && candles.length >= 20) {
        structures[tf] = analyzeMarketStructure(candles, this.config.pivotWindow);
      }
    }

    return determineHTFBias(structures);
  }

  /**
   * Handle new candle close event
   * Triggers ENTRY signal analysis
   * @param {string} symbol
   * @param {string} timeframe
   * @param {Object} candle
   */
  async onCandleClosed(symbol, timeframe, candle) {
    console.log(`[Engine] Analyzing ${symbol} ${timeframe} on candle close...`);
    
    // Check if this is an entry timeframe
    if (this.config.entryTimeframes.includes(timeframe)) {
      try {
        await this.analyzeForEntry(symbol, timeframe, false);
      } catch (err) {
        console.error(`[Engine] Error in onCandleClosed for ${symbol} ${timeframe}:`, err.message);
      }
    }
  }

  /**
   * Handle intrabar update event
   * Triggers SETUP signal analysis
   * @param {string} symbol
   * @param {string} timeframe
   * @param {Object} formingCandle
   */
  async onIntrabarUpdate(symbol, timeframe, formingCandle) {
    // Only process entry timeframes
    if (!this.config.entryTimeframes.includes(timeframe)) {
      return;
    }

    // Throttle intrabar updates (process every ~10 seconds to avoid spam)
    const now = Date.now();
    const key = `${symbol}_${timeframe}`;
    
    if (!this._lastIntrabarUpdate) {
      this._lastIntrabarUpdate = new Map();
    }
    
    const lastUpdate = this._lastIntrabarUpdate.get(key) || 0;
    if (now - lastUpdate < 10000) {
      return; // Skip, too frequent
    }
    
    this._lastIntrabarUpdate.set(key, now);

    try {
      await this.analyzeForSetup(symbol, timeframe);
    } catch (err) {
      console.error(`[Engine] Error in onIntrabarUpdate for ${symbol} ${timeframe}:`, err.message);
    }
  }
}

module.exports = SignalEngine;
