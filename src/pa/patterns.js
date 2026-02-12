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
 * Detect tweezer top (bearish reversal)
 * Two candles with similar highs at resistance
 * @param {Object} prevCandle - Previous candle
 * @param {Object} currentCandle - Current candle
 * @returns {Object} Tweezer info
 */
function detectTweezerTop(prevCandle, currentCandle) {
  const highDiff = Math.abs(prevCandle.high - currentCandle.high);
  const avgHigh = (prevCandle.high + currentCandle.high) / 2;
  const tolerance = avgHigh * 0.002; // 0.2% tolerance
  
  if (highDiff < tolerance) {
    const prevBullish = prevCandle.close > prevCandle.open;
    const currentBearish = currentCandle.close < currentCandle.open;
    
    if (prevBullish && currentBearish) {
      return {
        isTweezer: true,
        type: 'bearish',
        name: 'Tweezer Top',
        strength: 1 - (highDiff / avgHigh),
        level: avgHigh
      };
    }
  }
  
  return { isTweezer: false };
}

/**
 * Detect tweezer bottom (bullish reversal)
 * Two candles with similar lows at support
 * @param {Object} prevCandle - Previous candle
 * @param {Object} currentCandle - Current candle
 * @returns {Object} Tweezer info
 */
function detectTweezerBottom(prevCandle, currentCandle) {
  const lowDiff = Math.abs(prevCandle.low - currentCandle.low);
  const avgLow = (prevCandle.low + currentCandle.low) / 2;
  const tolerance = avgLow * 0.002; // 0.2% tolerance
  
  if (lowDiff < tolerance) {
    const prevBearish = prevCandle.close < prevCandle.open;
    const currentBullish = currentCandle.close > currentCandle.open;
    
    if (prevBearish && currentBullish) {
      return {
        isTweezer: true,
        type: 'bullish',
        name: 'Tweezer Bottom',
        strength: 1 - (lowDiff / avgLow),
        level: avgLow
      };
    }
  }
  
  return { isTweezer: false };
}

/**
 * Detect morning star (bullish reversal - 3 candle pattern)
 * @param {Array} candles - Last 3 candles minimum
 * @returns {Object} Morning star info
 */
function detectMorningStar(candles) {
  if (candles.length < 3) return { isMorningStar: false };
  
  const EPSILON = 0.0001; // Small value to prevent division by zero
  
  const first = candles[candles.length - 3];
  const second = candles[candles.length - 2];
  const third = candles[candles.length - 1];
  
  // First: bearish candle
  const firstBearish = first.close < first.open;
  const firstBody = Math.abs(first.close - first.open);
  
  // Second: small body (star/doji)
  const secondBody = Math.abs(second.close - second.open);
  const secondRange = second.high - second.low;
  const secondSmall = secondRange > 0 && (secondBody / secondRange) < 0.3;
  
  // Third: bullish candle
  const thirdBullish = third.close > third.open;
  const thirdBody = Math.abs(third.close - third.open);
  
  if (firstBearish && secondSmall && thirdBullish && thirdBody > firstBody * 0.5) {
    return {
      isMorningStar: true,
      type: 'bullish',
      name: 'Morning Star',
      strength: thirdBody / (firstBody + EPSILON)
    };
  }
  
  return { isMorningStar: false };
}

/**
 * Detect evening star (bearish reversal - 3 candle pattern)
 * @param {Array} candles - Last 3 candles minimum
 * @returns {Object} Evening star info
 */
function detectEveningStar(candles) {
  if (candles.length < 3) return { isEveningStar: false };
  
  const EPSILON = 0.0001; // Small value to prevent division by zero
  
  const first = candles[candles.length - 3];
  const second = candles[candles.length - 2];
  const third = candles[candles.length - 1];
  
  // First: bullish candle
  const firstBullish = first.close > first.open;
  const firstBody = Math.abs(first.close - first.open);
  
  // Second: small body (star/doji)
  const secondBody = Math.abs(second.close - second.open);
  const secondRange = second.high - second.low;
  const secondSmall = secondRange > 0 && (secondBody / secondRange) < 0.3;
  
  // Third: bearish candle
  const thirdBearish = third.close < third.open;
  const thirdBody = Math.abs(third.close - third.open);
  
  if (firstBullish && secondSmall && thirdBearish && thirdBody > firstBody * 0.5) {
    return {
      isEveningStar: true,
      type: 'bearish',
      name: 'Evening Star',
      strength: thirdBody / (firstBody + EPSILON)
    };
  }
  
  return { isEveningStar: false };
}

/**
 * Detect inside bar (consolidation/breakout setup)
 * Current candle's range is within previous candle's range
 * @param {Object} prevCandle - Previous candle
 * @param {Object} currentCandle - Current candle
 * @returns {Object} Inside bar info
 */
function detectInsideBar(prevCandle, currentCandle) {
  const isInside = currentCandle.high <= prevCandle.high && 
                   currentCandle.low >= prevCandle.low;
  
  if (isInside) {
    return {
      isInsideBar: true,
      type: 'neutral', // Needs breakout to determine direction
      name: 'Inside Bar',
      strength: 1 - ((currentCandle.high - currentCandle.low) / (prevCandle.high - prevCandle.low)),
      breakoutLevel: {
        bullish: prevCandle.high,
        bearish: prevCandle.low
      }
    };
  }
  
  return { isInsideBar: false };
}

/**
 * Detect 2-bar reversal (key reversal pattern)
 * Strong reversal after making new high/low
 * @param {Object} prevCandle - Previous candle
 * @param {Object} currentCandle - Current candle
 * @returns {Object} 2-bar reversal info
 */
function detect2BarReversal(prevCandle, currentCandle) {
  // Bullish 2-bar reversal: new low then strong close above prev high
  if (currentCandle.low < prevCandle.low && currentCandle.close > prevCandle.high) {
    const range = currentCandle.high - currentCandle.low;
    const strength = range > 0 ? (currentCandle.close - currentCandle.low) / range : 0;
    
    return {
      is2BarReversal: true,
      type: 'bullish',
      name: '2-Bar Reversal (Bullish)',
      strength: strength
    };
  }
  
  // Bearish 2-bar reversal: new high then strong close below prev low
  if (currentCandle.high > prevCandle.high && currentCandle.close < prevCandle.low) {
    const range = currentCandle.high - currentCandle.low;
    const strength = range > 0 ? (currentCandle.high - currentCandle.close) / range : 0;
    
    return {
      is2BarReversal: true,
      type: 'bearish',
      name: '2-Bar Reversal (Bearish)',
      strength: strength
    };
  }
  
  return { is2BarReversal: false };
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

  // Check 3-candle patterns first (if enough candles)
  if (candles.length >= 3) {
    const morningStar = detectMorningStar(candles);
    if (morningStar.isMorningStar) {
      return morningStar;
    }
    
    const eveningStar = detectEveningStar(candles);
    if (eveningStar.isEveningStar) {
      return eveningStar;
    }
  }

  // Check 2-bar reversal
  const twoBarReversal = detect2BarReversal(prevCandle, currentCandle);
  if (twoBarReversal.is2BarReversal) {
    return twoBarReversal;
  }

  // Check tweezer patterns
  const tweezerTop = detectTweezerTop(prevCandle, currentCandle);
  if (tweezerTop.isTweezer) {
    return tweezerTop;
  }
  
  const tweezerBottom = detectTweezerBottom(prevCandle, currentCandle);
  if (tweezerBottom.isTweezer) {
    return tweezerBottom;
  }

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
  
  // Check inside bar (for potential breakout)
  const insideBar = detectInsideBar(prevCandle, currentCandle);
  if (insideBar.isInsideBar) {
    return insideBar;
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
  detectTweezerTop,
  detectTweezerBottom,
  detectMorningStar,
  detectEveningStar,
  detectInsideBar,
  detect2BarReversal,
  detectReversalPattern,
  getCandleStrength
};
