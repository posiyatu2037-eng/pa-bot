const { getCandleStrength } = require('./patterns');
const { calculateAverageVolume } = require('./setups');
const { findNextOpposingZones, findStopLossZone } = require('./zones');

/**
 * Score a trading signal (0-100)
 * Combines: HTF alignment, setup quality, candle strength, volume context, RSI divergence
 */

/**
 * Calculate signal score
 * @param {Object} setup - Setup object from setups.js
 * @param {Object} htfAlignment - HTF alignment from structure.js
 * @param {Array} candles - Recent candles
 * @param {Object} divergence - RSI divergence info (optional, bonus points)
 * @param {Object} config - Configuration with bonus settings
 * @returns {Object} { score, breakdown }
 */
function calculateScore(setup, htfAlignment, candles, divergence, config = {}) {
  let score = 0;
  const breakdown = {};

  // RSI divergence bonus value (default: 10)
  const rsiBonus = config.rsiDivergenceBonus !== undefined ? config.rsiDivergenceBonus : 10;

  // 1. HTF Alignment Score (0-30 points) - REQUIRED
  const htfScore = calculateHTFScore(setup.side, htfAlignment);
  score += htfScore;
  breakdown.htf = htfScore;

  // 2. Setup Quality Score (0-30 points) - REQUIRED (increased from 25)
  const setupScore = calculateSetupScore(setup);
  score += setupScore;
  breakdown.setup = setupScore;

  // 3. Candle Strength Score (0-25 points) - REQUIRED (increased from 20)
  const candleScore = calculateCandleScore(candles, setup.side);
  score += candleScore;
  breakdown.candle = candleScore;

  // 4. Volume Context Score (0-15 points) - REQUIRED
  const volumeScore = calculateVolumeScore(candles, setup);
  score += volumeScore;
  breakdown.volume = volumeScore;

  // 5. RSI Divergence Score (0-N points) - BONUS (configurable)
  const divergenceScore = calculateDivergenceScore(divergence, setup.side, rsiBonus);
  score += divergenceScore;
  breakdown.divergence = divergenceScore;

  return {
    score: Math.round(score),
    breakdown,
    maxScore: 100 + rsiBonus // Base 100 (HTF:30 + Setup:30 + Candle:25 + Volume:15) + RSI bonus
  };
}

/**
 * Calculate HTF alignment score (0-30)
 */
function calculateHTFScore(side, htfAlignment) {
  if (!htfAlignment) return 15;

  const { aligned, score: alignScore } = htfAlignment;

  if (aligned) {
    // Perfect alignment: 25-30 points
    return 25 + (alignScore * 5);
  } else {
    // Partial or no alignment: 5-20 points
    return 5 + (alignScore * 15);
  }
}

/**
 * Calculate setup quality score (0-30)
 */
function calculateSetupScore(setup) {
  let score = 10; // Base score for having a setup

  // Bonus for setup type
  if (setup.type === 'reversal') {
    score += 12; // Reversals at key levels are high quality
    
    // Extra bonus for strong pattern
    if (setup.pattern && setup.pattern.strength) {
      score += setup.pattern.strength * 8;
    }
  } else if (setup.type === 'breakout' && setup.isTrue) {
    score += 15; // True breakouts with volume
  } else if (setup.type === 'retest') {
    score += 12; // Retests are high quality
    if (setup.pattern) {
      score += 5;
    }
  } else if (setup.type === 'false_breakout' || setup.type === 'false_breakdown') {
    score += 10; // False breakout fades
  } else {
    score += 5; // Other setups
  }

  return Math.min(score, 30);
}

/**
 * Calculate candle strength score (0-25)
 */
function calculateCandleScore(candles, side) {
  if (candles.length < 2) return 12;

  const currentCandle = candles[candles.length - 1];
  const strength = getCandleStrength(currentCandle);

  let score = 12; // Base score

  // Bonus for strong directional candle
  if (side === 'LONG' && strength.isBullish) {
    score += strength.strength * 10;
    
    // Additional bonus for strong close in upper part of range
    if (strength.closeLocation > 0.7) {
      score += 3;
    }
    
    // Bonus for rejection of downside (hammer-like)
    if (strength.rejection && strength.rejection.type === 'downside') {
      score += strength.rejection.strength * 4;
    }
    
  } else if (side === 'SHORT' && strength.isBearish) {
    score += strength.strength * 10;
    
    // Additional bonus for strong close in lower part of range
    if (strength.closeLocation < 0.3) {
      score += 3;
    }
    
    // Bonus for rejection of upside (shooting star-like)
    if (strength.rejection && strength.rejection.type === 'upside') {
      score += strength.rejection.strength * 4;
    }
    
  } else {
    // Candle not aligned with signal direction
    score -= 6;
  }

  return Math.max(0, Math.min(score, 25));
}

/**
 * Calculate volume context score (0-15)
 */
function calculateVolumeScore(candles, setup) {
  if (candles.length < 20) return 7;

  const currentCandle = candles[candles.length - 1];
  const avgVolume = calculateAverageVolume(candles, 20);
  const volumeRatio = currentCandle.volume / avgVolume;

  let score = 5; // Base score

  // Bonus for volume spike
  if (volumeRatio > 2.0) {
    score += 10; // Very strong volume
  } else if (volumeRatio > 1.5) {
    score += 7; // Strong volume
  } else if (volumeRatio > 1.2) {
    score += 5; // Above average
  } else if (volumeRatio < 0.8) {
    score -= 3; // Below average (potential weakness)
  }

  // Extra bonus if setup already indicates volume spike
  if (setup.volumeSpike) {
    score += 3;
  }

  return Math.max(0, Math.min(score, 15));
}

/**
 * Calculate RSI divergence score (0-N, configurable bonus)
 */
function calculateDivergenceScore(divergence, side, maxBonus = 10) {
  if (!divergence) return 0;

  let score = 0;

  // Bonus for divergence aligned with signal direction
  if (side === 'LONG' && divergence.bullish) {
    score = maxBonus;
  } else if (side === 'SHORT' && divergence.bearish) {
    score = maxBonus;
  }

  return score;
}

/**
 * Calculate risk/reward levels with zone-based SL/TP
 * @param {Object} setup - Setup object with zones attached
 * @param {number} zoneSLBuffer - Buffer percentage for stop loss beyond zone (default: 0.2%)
 * @returns {Object} { entry, stopLoss, takeProfit1, takeProfit2, riskReward1, riskReward2, tpZones }
 */
function calculateLevels(setup, zoneSLBuffer = null) {
  const entry = setup.price;
  const slBuffer = zoneSLBuffer || parseFloat(process.env.ZONE_SL_BUFFER_PCT) || 0.2;
  
  let stopLoss, tp1, tp2;
  let tpZones = [];
  let slZone = null;

  // Get zones from setup (should be attached during detection)
  const zones = setup.zones || { support: [], resistance: [] };

  if (setup.side === 'LONG') {
    // Find stop loss zone below entry (support)
    slZone = findStopLossZone(entry, zones.support, 'LONG');
    
    if (slZone) {
      // Place SL below the support zone with buffer
      const bufferAmount = slZone.lower * (slBuffer / 100);
      stopLoss = slZone.lower - bufferAmount;
    } else if (setup.zone) {
      // Fallback: use setup zone
      const bufferAmount = setup.zone.lower * (slBuffer / 100);
      stopLoss = setup.zone.lower - bufferAmount;
    } else {
      // Last resort: fixed percentage
      stopLoss = entry * 0.99;
    }

    // Find take profit zones (resistance zones above entry) - up to 3 targets
    tpZones = findNextOpposingZones(entry, zones.resistance, 'LONG', 3);
    
    if (tpZones.length >= 2) {
      // Use zone centers as TP targets
      tp1 = tpZones[0].center;
      tp2 = tpZones[1].center;
    } else if (tpZones.length === 1) {
      // Only one TP zone available
      tp1 = tpZones[0].center;
      // Calculate TP2 based on risk/reward from TP1
      const risk = entry - stopLoss;
      tp2 = entry + risk * 3.0; // 3R as fallback
    } else {
      // No TP zones available, use traditional RR-based approach
      const risk = entry - stopLoss;
      tp1 = entry + risk * 1.5;
      tp2 = entry + risk * 3.0;
      console.log('[Levels] No TP zones found for LONG, using RR-based targets');
    }

  } else { // SHORT
    // Find stop loss zone above entry (resistance)
    slZone = findStopLossZone(entry, zones.resistance, 'SHORT');
    
    if (slZone) {
      // Place SL above the resistance zone with buffer
      const bufferAmount = slZone.upper * (slBuffer / 100);
      stopLoss = slZone.upper + bufferAmount;
    } else if (setup.zone) {
      // Fallback: use setup zone
      const bufferAmount = setup.zone.upper * (slBuffer / 100);
      stopLoss = setup.zone.upper + bufferAmount;
    } else {
      // Last resort: fixed percentage
      stopLoss = entry * 1.01;
    }

    // Find take profit zones (support zones below entry) - up to 3 targets
    tpZones = findNextOpposingZones(entry, zones.support, 'SHORT', 3);
    
    if (tpZones.length >= 2) {
      // Use zone centers as TP targets
      tp1 = tpZones[0].center;
      tp2 = tpZones[1].center;
    } else if (tpZones.length === 1) {
      // Only one TP zone available
      tp1 = tpZones[0].center;
      // Calculate TP2 based on risk/reward from TP1
      const risk = stopLoss - entry;
      tp2 = entry - risk * 3.0; // 3R as fallback
    } else {
      // No TP zones available, use traditional RR-based approach
      const risk = stopLoss - entry;
      tp1 = entry - risk * 1.5;
      tp2 = entry - risk * 3.0;
      console.log('[Levels] No TP zones found for SHORT, using RR-based targets');
    }
  }

  const risk = Math.abs(entry - stopLoss);
  const reward1 = Math.abs(tp1 - entry);
  const rr1 = reward1 / risk;
  const reward2 = Math.abs(tp2 - entry);
  const rr2 = reward2 / risk;

  return {
    entry: parseFloat(entry.toFixed(8)),
    stopLoss: parseFloat(stopLoss.toFixed(8)),
    takeProfit1: parseFloat(tp1.toFixed(8)),
    takeProfit2: parseFloat(tp2.toFixed(8)),
    riskReward1: parseFloat(rr1.toFixed(2)),
    riskReward2: parseFloat(rr2.toFixed(2)),
    slZone: slZone ? { center: slZone.center, type: slZone.type } : null,
    tpZones: tpZones.map(z => ({ center: z.center, type: z.type, distancePercent: z.distancePercent }))
  };
}

module.exports = {
  calculateScore,
  calculateLevels,
  calculateHTFScore,
  calculateSetupScore,
  calculateCandleScore,
  calculateVolumeScore,
  calculateDivergenceScore
};
