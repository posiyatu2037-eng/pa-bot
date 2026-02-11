/**
 * Detect reversal candlestick patterns
 */

/**
 * Detect pin bar / hammer / shooting star
 * @param {Object} candle - Candle object
 * @returns {Object} { isPinBar, type, strength }
 */
function detectPinBar(candle) {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  
  if (range === 0) return { isPinBar: false };

  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;

  const bodyPercent = (body / range) * 100;
  const upperWickPercent = (upperWick / range) * 100;
  const lowerWickPercent = (lowerWick / range) * 100;

  // Pin bar criteria: small body (< 30%), one long wick (> 60%)
  if (bodyPercent < 30) {
    // Bullish pin bar (hammer): long lower wick
    if (lowerWickPercent > 60 && upperWickPercent < 20) {
      return {
        isPinBar: true,
        type: 'bullish',
        name: 'Hammer',
        strength: lowerWickPercent / 100,
        rejection: 'downside'
      };
    }
    // Bearish pin bar (shooting star): long upper wick
    else if (upperWickPercent > 60 && lowerWickPercent < 20) {
      return {
        isPinBar: true,
        type: 'bearish',
        name: 'Shooting Star',
        strength: upperWickPercent / 100,
        rejection: 'upside'
      };
    }
  }

  return { isPinBar: false };
}

/**
 * Detect engulfing pattern (2-candle pattern)
 * @param {Object} prevCandle - Previous candle
 * @param {Object} currentCandle - Current candle
 * @returns {Object} { isEngulfing, type, strength }
 */
function detectEngulfing(prevCandle, currentCandle) {
  const prevBody = Math.abs(prevCandle.close - prevCandle.open);
  const currentBody = Math.abs(currentCandle.close - currentCandle.open);

  const prevIsBullish = currentCandle.close > currentCandle.open;
  const prevIsBearish = prevCandle.close < prevCandle.open;
  const currentIsBullish = currentCandle.close > currentCandle.open;
  const currentIsBearish = currentCandle.close < currentCandle.open;

  // Bullish engulfing: bearish candle followed by larger bullish candle
  if (prevIsBearish && currentIsBullish) {
    const engulfs = currentCandle.open <= prevCandle.close && 
                    currentCandle.close >= prevCandle.open;
    if (engulfs && currentBody > prevBody) {
      return {
        isEngulfing: true,
        type: 'bullish',
        name: 'Bullish Engulfing',
        strength: currentBody / prevBody
      };
    }
  }

  // Bearish engulfing: bullish candle followed by larger bearish candle
  if (prevIsBullish && currentIsBearish) {
    const engulfs = currentCandle.open >= prevCandle.close && 
                    currentCandle.close <= prevCandle.open;
    if (engulfs && currentBody > prevBody) {
      return {
        isEngulfing: true,
        type: 'bearish',
        name: 'Bearish Engulfing',
        strength: currentBody / prevBody
      };
    }
  }

  return { isEngulfing: false };
}

/**
 * Detect doji candle (indecision)
 * @param {Object} candle - Candle object
 * @returns {Object} { isDoji, type }
 */
function detectDoji(candle) {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;

  if (range === 0) return { isDoji: false };

  const bodyPercent = (body / range) * 100;

  // Doji: very small body (< 5% of range)
  if (bodyPercent < 5) {
    return {
      isDoji: true,
      type: 'neutral',
      name: 'Doji',
      strength: 1 - (bodyPercent / 5)
    };
  }

  return { isDoji: false };
}

/**
 * Detect any reversal pattern
 * @param {Array} candles - Array of candles (needs at least last 2)
 * @returns {Object|null} Pattern info or null
 */
function detectReversalPattern(candles) {
  if (candles.length < 2) return null;

  const currentCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];

  // Check pin bar
  const pinBar = detectPinBar(currentCandle);
  if (pinBar.isPinBar) {
    return pinBar;
  }

  // Check engulfing
  const engulfing = detectEngulfing(prevCandle, currentCandle);
  if (engulfing.isEngulfing) {
    return engulfing;
  }

  // Check doji
  const doji = detectDoji(currentCandle);
  if (doji.isDoji) {
    return doji;
  }

  return null;
}

/**
 * Get candle strength/momentum
 * @param {Object} candle - Candle object
 * @returns {Object} { strength, direction, isBullish, isBearish }
 */
function getCandleStrength(candle) {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;

  if (range === 0) {
    return { 
      strength: 0, 
      direction: 'neutral', 
      isBullish: false, 
      isBearish: false,
      bodyPercent: 0,
      closeLocation: 0.5,
      rejection: null
    };
  }

  const bodyPercent = (body / range) * 100;
  const isBullish = candle.close > candle.open;
  const isBearish = candle.close < candle.open;
  
  // Calculate close location within range (0 = low, 1 = high)
  const closeLocation = (candle.close - candle.low) / range;
  
  // Assess rejection strength
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  const upperWickPercent = (upperWick / range) * 100;
  const lowerWickPercent = (lowerWick / range) * 100;
  
  let rejection = null;
  if (upperWickPercent > 40) {
    rejection = { type: 'upside', strength: upperWickPercent / 100 };
  } else if (lowerWickPercent > 40) {
    rejection = { type: 'downside', strength: lowerWickPercent / 100 };
  }

  return {
    strength: bodyPercent / 100,
    direction: isBullish ? 'bullish' : (isBearish ? 'bearish' : 'neutral'),
    isBullish,
    isBearish,
    bodyPercent,
    closeLocation, // 0-1 where 0.5 is middle, >0.5 is upper half, <0.5 is lower half
    upperWickPercent,
    lowerWickPercent,
    rejection
  };
}

module.exports = {
  detectPinBar,
  detectEngulfing,
  detectDoji,
  detectReversalPattern,
  getCandleStrength
};
