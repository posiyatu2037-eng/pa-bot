/**
 * Structure Event Detection Module
 * Detects BOS (Break of Structure) and CHoCH (Change of Character)
 * Based on Smart Money Concepts (SMC) / Inner Circle Trader (ICT) methodology
 */

/**
 * Detect Break of Structure (BOS)
 * BOS = Breaking the last swing high (in uptrend) or swing low (in downtrend)
 * Confirms trend continuation
 * 
 * @param {Array} candles - Array of candles
 * @param {Array} pivotHighs - Recent pivot high indices
 * @param {Array} pivotLows - Recent pivot low indices
 * @param {number} lookback - How many recent pivots to check (default: 3)
 * @returns {Object|null} BOS event or null
 */
function detectBOS(candles, pivotHighs, pivotLows, lookback = 3) {
  if (candles.length < 10) return null;
  
  const currentCandle = candles[candles.length - 1];
  const currentPrice = currentCandle.close;
  
  // Get recent pivots
  const recentHighs = pivotHighs.slice(-lookback);
  const recentLows = pivotLows.slice(-lookback);
  
  if (recentHighs.length < 2 || recentLows.length < 2) {
    return null;
  }
  
  // Check for bullish BOS: breaking above recent swing high
  const lastSwingHigh = Math.max(...recentHighs.map(idx => candles[idx].high));
  const secondLastSwingHigh = recentHighs.length >= 2 
    ? candles[recentHighs[recentHighs.length - 2]].high 
    : 0;
  
  if (currentPrice > lastSwingHigh && lastSwingHigh > secondLastSwingHigh) {
    return {
      type: 'BOS',
      direction: 'bullish',
      level: lastSwingHigh,
      strength: (currentPrice - lastSwingHigh) / lastSwingHigh,
      description: 'Break of Structure (Bullish)',
      timestamp: currentCandle.closeTime
    };
  }
  
  // Check for bearish BOS: breaking below recent swing low
  const lastSwingLow = Math.min(...recentLows.map(idx => candles[idx].low));
  const secondLastSwingLow = recentLows.length >= 2 
    ? candles[recentLows[recentLows.length - 2]].low 
    : Infinity;
  
  if (currentPrice < lastSwingLow && lastSwingLow < secondLastSwingLow) {
    return {
      type: 'BOS',
      direction: 'bearish',
      level: lastSwingLow,
      strength: (lastSwingLow - currentPrice) / lastSwingLow,
      description: 'Break of Structure (Bearish)',
      timestamp: currentCandle.closeTime
    };
  }
  
  return null;
}

/**
 * Detect Change of Character (CHoCH)
 * CHoCH = Breaking the last swing low (in uptrend) or swing high (in downtrend)
 * Signals potential trend reversal
 * 
 * @param {Array} candles - Array of candles
 * @param {Array} pivotHighs - Recent pivot high indices
 * @param {Array} pivotLows - Recent pivot low indices
 * @param {string} currentTrend - Current trend ('up', 'down', 'neutral')
 * @param {number} lookback - How many recent pivots to check (default: 3)
 * @returns {Object|null} CHoCH event or null
 */
function detectCHoCH(candles, pivotHighs, pivotLows, currentTrend, lookback = 3) {
  if (candles.length < 10) return null;
  
  const currentCandle = candles[candles.length - 1];
  const currentPrice = currentCandle.close;
  
  // Get recent pivots
  const recentHighs = pivotHighs.slice(-lookback);
  const recentLows = pivotLows.slice(-lookback);
  
  if (recentHighs.length < 2 || recentLows.length < 2) {
    return null;
  }
  
  // In uptrend, CHoCH = breaking below recent swing low
  if (currentTrend === 'up') {
    const lastSwingLow = Math.min(...recentLows.map(idx => candles[idx].low));
    const secondLastSwingLow = recentLows.length >= 2 
      ? candles[recentLows[recentLows.length - 2]].low 
      : Infinity;
    
    if (currentPrice < lastSwingLow) {
      return {
        type: 'CHoCH',
        direction: 'bearish',
        level: lastSwingLow,
        previousTrend: 'up',
        newTrend: 'down',
        strength: (lastSwingLow - currentPrice) / lastSwingLow,
        description: 'Change of Character (Uptrend → Downtrend)',
        timestamp: currentCandle.closeTime
      };
    }
  }
  
  // In downtrend, CHoCH = breaking above recent swing high
  if (currentTrend === 'down') {
    const lastSwingHigh = Math.max(...recentHighs.map(idx => candles[idx].high));
    const secondLastSwingHigh = recentHighs.length >= 2 
      ? candles[recentHighs[recentHighs.length - 2]].high 
      : 0;
    
    if (currentPrice > lastSwingHigh) {
      return {
        type: 'CHoCH',
        direction: 'bullish',
        level: lastSwingHigh,
        previousTrend: 'down',
        newTrend: 'up',
        strength: (currentPrice - lastSwingHigh) / lastSwingHigh,
        description: 'Change of Character (Downtrend → Uptrend)',
        timestamp: currentCandle.closeTime
      };
    }
  }
  
  return null;
}

/**
 * Detect structure events (BOS or CHoCH)
 * @param {Array} candles - Array of candles
 * @param {Array} pivotHighs - Recent pivot high indices
 * @param {Array} pivotLows - Recent pivot low indices
 * @param {string} currentTrend - Current trend ('up', 'down', 'neutral')
 * @param {number} lookback - How many recent pivots to check (default: 3)
 * @returns {Object|null} Structure event or null
 */
function detectStructureEvents(candles, pivotHighs, pivotLows, currentTrend, lookback = 3) {
  // Try to detect CHoCH first (trend reversal signal)
  const choch = detectCHoCH(candles, pivotHighs, pivotLows, currentTrend, lookback);
  if (choch) {
    return choch;
  }
  
  // If no CHoCH, check for BOS (trend continuation)
  const bos = detectBOS(candles, pivotHighs, pivotLows, lookback);
  if (bos) {
    return bos;
  }
  
  return null;
}

/**
 * Get the most recent structure event from recent candles
 * Useful for checking if a recent BOS/CHoCH occurred
 * 
 * @param {Array} candles - Array of candles
 * @param {Array} pivotHighs - Pivot high indices
 * @param {Array} pivotLows - Pivot low indices
 * @param {string} currentTrend - Current trend
 * @param {number} candleLookback - How many candles back to check (default: 10)
 * @returns {Object|null} Most recent structure event or null
 */
function getRecentStructureEvent(candles, pivotHighs, pivotLows, currentTrend, candleLookback = 10) {
  if (candles.length < candleLookback) {
    candleLookback = candles.length;
  }
  
  // Check each candle in recent history
  for (let i = 0; i < candleLookback; i++) {
    const candleSlice = candles.slice(0, candles.length - i);
    const event = detectStructureEvents(candleSlice, pivotHighs, pivotLows, currentTrend);
    
    if (event) {
      return {
        ...event,
        candlesAgo: i
      };
    }
  }
  
  return null;
}

module.exports = {
  detectBOS,
  detectCHoCH,
  detectStructureEvents,
  getRecentStructureEvent
};
