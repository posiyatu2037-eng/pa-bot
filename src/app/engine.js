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
 * ENTRY-only by default (SETUP disabled unless explicitly enabled)
 */
class SignalEngine {
  constructor(config = {}) {
    // Default ENTRY-only
    const stagesEnabled = (process.env.SIGNAL_STAGE_ENABLED || 'entry')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const entryTimeframes = (process.env.ENTRY_TIMEFRAMES || '1h')
      .split(',')
      .map((tf) => tf.trim())
      .filter(Boolean);

    const htfTimeframes = (process.env.HTF_TIMEFRAMES || '4h,1d')
      .split(',')
      .map((tf) => tf.trim())
      .filter(Boolean);

    this.config = {
      pivotWindow: parseInt(process.env.PIVOT_WINDOW) || 5,
      zoneLookback: parseInt(process.env.ZONE_LOOKBACK) || 100,
      zoneTolerance: parseFloat(process.env.ZONE_TOLERANCE_PCT) || 0.5,
      volumeSpikeThreshold: parseFloat(process.env.VOLUME_SPIKE_THRESHOLD) || 1.5,
      minScore: parseInt(process.env.MIN_SIGNAL_SCORE) || 70, // legacy
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

    // Keep map for compatibility, but setup is off by default
    this.setupAlerts = new Map();

    console.log('[Engine] Signal engine initialized with config:', this.config);
  }

  async analyzeForEntry(symbol, timeframe, isIntrabar = false) {
    if (!this.config.entryStageEnabled) return null;

    try {
      const candles = klinesCache.get(symbol, timeframe);
      if (!candles || candles.length < 100) return null;

      const setup = detectSetup(candles, this.config);
      if (!setup) return null;

      console.log(`[Engine] ENTRY: Setup detected: ${symbol} ${timeframe} - ${setup.name}`);

      const htfBias = await this.getHTFBias(symbol);
      const htfAlignment = checkHTFAlignment(setup.side, htfBias);

      if (!htfAlignment.aligned) {
        console.log(`[Engine] ENTRY: HTF not aligned for ${symbol} ${timeframe}, skipping ENTRY`);
        return null;
      }

      const pivotHighs = getRecentPivotHighs(candles, this.config.pivotWindow, 10);
      const pivotLows = getRecentPivotLows(candles, this.config.pivotWindow, 10);
      const divergence = detectRSIDivergence(candles, pivotHighs, pivotLows);

      const currentCandle = candles[candles.length - 1];
      const recentCandles = candles.slice(-20);
      const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
      const volumeRatio = currentCandle.volume / avgVolume;

      if (this.config.requireVolumeConfirmation && volumeRatio < this.config.volumeSpikeThreshold) {
        console.log(
          `[Engine] ENTRY: Insufficient volume (${volumeRatio.toFixed(2)}x < ${this.config.volumeSpikeThreshold}x), skipping`
        );
        return null;
      }

      const scoreResult = calculateScore(setup, htfAlignment, candles, divergence, this.config);

      if (scoreResult.score < this.config.entryScoreThreshold) {
        console.log(
          `[Engine] ENTRY: Score too low (${scoreResult.score} < ${this.config.entryScoreThreshold}), skipping`
        );
        return null;
      }

      const levels = calculateLevels(setup, this.config.zoneSLBuffer);

      if (typeof levels.riskReward1 === 'number' && levels.riskReward1 < this.config.minRR) {
        console.log(
          `[Engine] ENTRY: R:R too low (${levels.riskReward1.toFixed(2)} < ${this.config.minRR}), skipping`
        );
        return null;
      }

      const chaseEval = evaluateChaseRisk(candles, setup, this.config);
      if (chaseEval.decision === 'CHASE_NO') return null;

      const zoneKey = setup.zone ? setup.zone.key : 'none';
      if (isOnCooldown(symbol, timeframe, setup.side, zoneKey)) return null;

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
        setup_type: setup.type,
        setup_name: setup.name,
        entry: levels.entry,
        stop_loss: levels.stopLoss,
        take_profit1: levels.takeProfit1,
        take_profit2: levels.takeProfit2,
        risk_reward: levels.riskReward1,
        zone_key: zoneKey
      };

      console.log(`[Engine] 🎯 ENTRY SIGNAL: ${symbol} ${timeframe} ${setup.side} @ ${levels.entry}`);

      const sent = await sendSignal(signal);
      if (!sent) return null;

      saveSignal(signal);
      addCooldown(symbol, timeframe, setup.side, zoneKey, this.config.cooldownMinutes);

      return signal;
    } catch (err) {
      console.error(`[Engine] ENTRY: Error analyzing ${symbol} ${timeframe}:`, err.message);
      return null;
    }
  }

  // SETUP disabled by default: keep method for backward compatibility but short-circuit unless enabled
  async analyzeForSetup(symbol, timeframe) {
    if (!this.config.setupStageEnabled) return null;
    // If you ever re-enable setup, keep your old implementation or re-add here.
    return null;
  }

  async getHTFBias(symbol) {
    const structures = {};
    for (const tf of this.config.htfTimeframes) {
      const candles = klinesCache.get(symbol, tf);
      if (candles && candles.length >= 20) {
        structures[tf] = analyzeMarketStructure(candles, this.config.pivotWindow);
      }
    }
    return determineHTFBias(structures);
  }

  async onCandleClosed(symbol, timeframe, candle) {
    if (this.config.entryTimeframes.includes(timeframe)) {
      await this.analyzeForEntry(symbol, timeframe, false);
    }
  }

  async onIntrabarUpdate(symbol, timeframe, formingCandle) {
    // ENTRY-only: do nothing (intrabar setup disabled)
    return;
  }
}

module.exports = SignalEngine;
