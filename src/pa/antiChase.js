/**
 * Anti-Chase Logic Module
 * Prevents entering trades when price has moved too far from ideal entry
 * Classifies situations as: CHASE_NO, CHASE_OK, or REVERSAL_WATCH
 */

const { getCandleStrength } = require('./patterns');

/**
 * Calculate Average True Range (ATR)
 * @param {Array} candles - Array of candles
 * @param {number} period - ATR period (default 14)
 * @returns {number} ATR value
 */
function calculateATR(candles, period = 14) {
  if (candles.length < period + 1) return 0;

  const trueRanges = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  // Calculate average of last 'period' TRs
  const recentTRs = trueRanges.slice(-period);
  const atr = recentTRs.reduce((sum, tr) => sum + tr, 0) / period;
  
  return atr;
}

/**
 * Calculate percentage move from reference price
 * @param {number} currentPrice
 * @param {number} referencePrice
 * @returns {number} Percentage move (absolute)
 */
function calculatePercentMove(currentPrice, referencePrice) {
  return Math.abs((currentPrice - referencePrice) / referencePrice * 100);
}

/**
 * Analyze candle body-to-range ratio
 * @param {Object} candle
 * @returns {Object} { bodyToRange, wickRatio, hasLargeBody }
 */
function analyzeCandleBody(candle) {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  
  if (range === 0) {
    return { bodyToRange: 0, wickRatio: 0, hasLargeBody: false };
  }

  const bodyToRange = body / range;
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const wickRatio = (upperWick + lowerWick) / range;
  
  // Large body = > 70% of range
  const hasLargeBody = bodyToRange > 0.7;

  return { bodyToRange, wickRatio, hasLargeBody };
}

/**
 * Check for volume spike/climax
 * @param {Array} candles - Array of candles
 * @param {number} threshold - Volume spike threshold multiplier
 * @returns {Object} { isSpike, ratio, isClimax }
 */
function checkVolumeSpike(candles, threshold = 2.0) {
  if (candles.length < 20) {
    return { isSpike: false, ratio: 1, isClimax: false };
  }

  const currentVolume = candles[candles.length - 1].volume;
  const recentCandles = candles.slice(-20, -1); // Exclude current
  const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
  const maxRecentVolume = Math.max(...recentCandles.map(c => c.volume));
  
  const ratio = currentVolume / avgVolume;
  const isSpike = ratio >= threshold;
  
  // Climax = volume spike > 2.5x AND highest in recent period
  const isClimax = ratio >= 2.5 && currentVolume > maxRecentVolume;

  return { isSpike, ratio, isClimax };
}

/**
 * Detect momentum change in consecutive candles
 * @param {Array} candles - Array of candles (need at least last 3)
 * @returns {Object} { hasSlowdown, hasAcceleration, consecutiveBullish, consecutiveBearish }
 */
function detectMomentumChange(candles) {
  if (candles.length < 3) {
    return { hasSlowdown: false, hasAcceleration: false, consecutiveBullish: 0, consecutiveBearish: 0 };
  }

  const recentCandles = candles.slice(-5); // Last 5 candles
  
  // Count consecutive same-direction candles
  let consecutiveBullish = 0;
  let consecutiveBearish = 0;
  
  for (let i = recentCandles.length - 1; i >= 0; i--) {
    const candle = recentCandles[i];
    const isBullish = candle.close > candle.open;
    const isBearish = candle.close < candle.open;
    
    if (isBullish) {
      if (i === recentCandles.length - 1 || consecutiveBullish > 0) {
        consecutiveBullish++;
      } else {
        break;
      }
    } else if (isBearish) {
      if (i === recentCandles.length - 1 || consecutiveBearish > 0) {
        consecutiveBearish++;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  // Check for momentum slowdown (reducing body sizes)
  let hasSlowdown = false;
  if (recentCandles.length >= 3) {
    const bodies = recentCandles.slice(-3).map(c => Math.abs(c.close - c.open));
    hasSlowdown = bodies[2] < bodies[1] && bodies[1] < bodies[0];
  }

  // Check for acceleration (increasing body sizes)
  let hasAcceleration = false;
  if (recentCandles.length >= 3) {
    const bodies = recentCandles.slice(-3).map(c => Math.abs(c.close - c.open));
    hasAcceleration = bodies[2] > bodies[1] && bodies[1] > bodies[0];
  }

  return { hasSlowdown, hasAcceleration, consecutiveBullish, consecutiveBearish };
}

/**
 * Detect micro-structure: Change of Character (CHoCH) or Break of Structure (BOS)
 * Simplified version: looks for price breaking recent swing highs/lows
 * @param {Array} candles - Array of candles
 * @returns {Object} { hasCHoCH, hasBOS, type }
 */
function detectMicroStructure(candles) {
  if (candles.length < 10) {
    return { hasCHoCH: false, hasBOS: false, type: null };
  }

  const recentCandles = candles.slice(-10);
  const currentCandle = candles[candles.length - 1];
  
  // Find recent swing high and low (last 5-9 candles, excluding current)
  const swingCandles = recentCandles.slice(0, -1);
  const swingHigh = Math.max(...swingCandles.map(c => c.high));
  const swingLow = Math.min(...swingCandles.map(c => c.low));
  
  // Check for BOS (Break of Structure) - bullish or bearish
  const bullishBOS = currentCandle.close > swingHigh;
  const bearishBOS = currentCandle.close < swingLow;
  
  // CHoCH (Change of Character) - requires more context
  // For simplicity, we'll detect it as a failed test followed by reversal
  let hasCHoCH = false;
  let chochType = null;
  
  if (candles.length >= 15) {
    const olderCandles = candles.slice(-15, -10);
    const olderHigh = Math.max(...olderCandles.map(c => c.high));
    const olderLow = Math.min(...olderCandles.map(c => c.low));
    
    // Bullish CHoCH: price was making lower lows, now breaks recent high
    if (swingLow < olderLow && bullishBOS) {
      hasCHoCH = true;
      chochType = 'bullish';
    }
    
    // Bearish CHoCH: price was making higher highs, now breaks recent low
    if (swingHigh > olderHigh && bearishBOS) {
      hasCHoCH = true;
      chochType = 'bearish';
    }
  }

  return {
    hasCHoCH,
    hasBOS: bullishBOS || bearishBOS,
    type: hasCHoCH ? chochType : (bullishBOS ? 'bullish_bos' : (bearishBOS ? 'bearish_bos' : null))
  };
}

/**
 * Main anti-chase decision function
 * @param {Array} candles - Array of candles
 * @param {Object} setup - Setup object with entry price and side
 * @param {Object} config - Configuration with thresholds
 * @returns {Object} { decision, reason, metrics }
 */
function evaluateChaseRisk(candles, setup, config = {}) {
  const maxATRMultiple = parseFloat(config.antiChaseMaxATR) || 2.0;
  const maxPctMove = parseFloat(config.antiChaseMaxPct) || 3.0;
  
  const currentCandle = candles[candles.length - 1];
  const currentPrice = currentCandle.close;
  const entryPrice = setup.price || setup.entry || currentPrice;
  const side = setup.side;
  
  // Calculate metrics
  const atr = calculateATR(candles);
  const pctMove = calculatePercentMove(currentPrice, entryPrice);
  const atrMove = Math.abs(currentPrice - entryPrice) / (atr || 1);
  
  const bodyAnalysis = analyzeCandleBody(currentCandle);
  const volumeAnalysis = checkVolumeSpike(candles, 2.0);
  const momentumAnalysis = detectMomentumChange(candles);
  const structureAnalysis = detectMicroStructure(candles);
  const candleStrength = getCandleStrength(currentCandle);

  // Determine if price has moved away from entry
  let hasMovedAway = false;
  if (side === 'LONG') {
    hasMovedAway = currentPrice > entryPrice;
  } else {
    hasMovedAway = currentPrice < entryPrice;
  }

  // Build metrics object
  const metrics = {
    atr,
    pctMove,
    atrMove,
    bodyAnalysis,
    volumeAnalysis,
    momentumAnalysis,
    structureAnalysis,
    candleStrength,
    hasMovedAway
  };

  // Decision logic
  let decision = 'CHASE_OK'; // Default: allow entry
  let reason = 'Price within acceptable range';
  let score = 0; // Chase risk score (higher = more risky)

  // If price hasn't moved away significantly, always OK
  if (!hasMovedAway || (atrMove < 0.5 && pctMove < 0.5)) {
    return { decision: 'CHASE_OK', reason: 'Price at or near ideal entry', metrics, score: 0 };
  }

  // Calculate chase risk score
  // Factor 1: Distance moved (0-40 points)
  if (atrMove > maxATRMultiple || pctMove > maxPctMove) {
    score += 40;
  } else {
    score += (atrMove / maxATRMultiple) * 20 + (pctMove / maxPctMove) * 20;
  }

  // Factor 2: Consecutive candles in same direction (0-20 points)
  const consecutiveCount = side === 'LONG' ? momentumAnalysis.consecutiveBullish : momentumAnalysis.consecutiveBearish;
  if (consecutiveCount >= 5) {
    score += 20;
  } else if (consecutiveCount >= 3) {
    score += 15;
  } else if (consecutiveCount >= 2) {
    score += 10;
  }

  // Factor 3: Large body candles suggest strong momentum (0-15 points)
  if (bodyAnalysis.hasLargeBody && candleStrength.strength > 0.7) {
    score += 15;
  } else if (bodyAnalysis.bodyToRange > 0.5) {
    score += 8;
  }

  // Factor 4: Volume analysis (adjusts score)
  if (volumeAnalysis.isClimax) {
    // Climax volume can signal exhaustion - reduce chase risk
    score -= 15;
  } else if (volumeAnalysis.isSpike && volumeAnalysis.ratio > 2.5) {
    // High volume with no climax suggests continuation - increase risk
    score += 10;
  }

  // Factor 5: Momentum changes (adjusts score)
  if (momentumAnalysis.hasSlowdown) {
    // Momentum slowing down - safer to enter
    score -= 20;
  } else if (momentumAnalysis.hasAcceleration) {
    // Momentum accelerating - higher chase risk
    score += 10;
  }

  // Factor 6: Micro-structure (adjusts score)
  if (structureAnalysis.hasCHoCH) {
    // CHoCH suggests potential reversal
    if ((side === 'LONG' && structureAnalysis.type === 'bullish') ||
        (side === 'SHORT' && structureAnalysis.type === 'bearish')) {
      score -= 25; // Reversal setup aligned with our side
    }
  }

  // Make decision based on score
  if (score >= 50) {
    decision = 'CHASE_NO';
    reason = 'Too extended - likely trap or late entry. ';
    
    if (consecutiveCount >= 5) reason += 'Many consecutive candles. ';
    if (atrMove > maxATRMultiple) reason += `Moved ${atrMove.toFixed(1)}x ATR. `;
    if (bodyAnalysis.hasLargeBody) reason += 'Large body candle. ';
    
  } else if (score >= 25 && score < 50) {
    decision = 'CHASE_OK';
    reason = 'Acceptable chase - prefer pullback/limit entry. ';
    
    if (volumeAnalysis.isClimax) reason += 'Volume climax detected. ';
    if (momentumAnalysis.hasSlowdown) reason += 'Momentum slowing. ';
    
  } else {
    // score < 25
    // Check for reversal watch conditions
    if (volumeAnalysis.isClimax || 
        (consecutiveCount >= 4 && momentumAnalysis.hasSlowdown) ||
        (structureAnalysis.hasCHoCH && 
         ((side === 'LONG' && structureAnalysis.type === 'bearish') ||
          (side === 'SHORT' && structureAnalysis.type === 'bullish')))) {
      
      decision = 'REVERSAL_WATCH';
      reason = 'Trend exhaustion signals - watch for reversal. ';
      
      if (volumeAnalysis.isClimax) reason += 'Volume climax. ';
      if (momentumAnalysis.hasSlowdown) reason += 'Momentum slowing. ';
      if (structureAnalysis.hasCHoCH) reason += 'CHoCH detected. ';
      
    } else {
      decision = 'CHASE_OK';
      reason = 'Good entry conditions';
    }
  }

  return { decision, reason: reason.trim(), metrics, score };
}

module.exports = {
  calculateATR,
  calculatePercentMove,
  analyzeCandleBody,
  checkVolumeSpike,
  detectMomentumChange,
  detectMicroStructure,
  evaluateChaseRisk
};
