/**
 * Liquidity Sweep Detection Module
 * Detects when price sweeps recent swing highs/lows or zone boundaries
 * and then closes back inside, indicating a liquidity grab / stop hunt
 */

/**
 * Detect liquidity sweep of a swing high
 * Sweep = wick above high, but close back below it
 * 
 * @param {Array} candles - Array of candles
 * @param {number} swingHighIndex - Index of swing high to check
 * @param {number} lookForward - How many candles forward to check for sweep (default: 5)
 * @returns {Object|null} Sweep info or null
 */
function detectSwingHighSweep(candles, swingHighIndex, lookForward = 5) {
  if (swingHighIndex >= candles.length - 1) return null;
  
  const swingHigh = candles[swingHighIndex].high;
  const endIndex = Math.min(swingHighIndex + lookForward + 1, candles.length);
  
  // Check subsequent candles for sweep
  for (let i = swingHighIndex + 1; i < endIndex; i++) {
    const candle = candles[i];
    
    // Sweep condition: high exceeds swing high, but close is below it
    if (candle.high > swingHigh && candle.close < swingHigh) {
      return {
        type: 'sweep',
        direction: 'bearish', // Sweep high = bearish signal
        level: swingHigh,
        sweepCandle: i,
        wickAbove: candle.high - swingHigh,
        closeDistance: swingHigh - candle.close,
        strength: (candle.high - candle.close) / (candle.high - candle.low),
        description: 'Liquidity Sweep Above Swing High'
      };
    }
  }
  
  return null;
}

/**
 * Detect liquidity sweep of a swing low
 * Sweep = wick below low, but close back above it
 * 
 * @param {Array} candles - Array of candles
 * @param {number} swingLowIndex - Index of swing low to check
 * @param {number} lookForward - How many candles forward to check for sweep (default: 5)
 * @returns {Object|null} Sweep info or null
 */
function detectSwingLowSweep(candles, swingLowIndex, lookForward = 5) {
  if (swingLowIndex >= candles.length - 1) return null;
  
  const swingLow = candles[swingLowIndex].low;
  const endIndex = Math.min(swingLowIndex + lookForward + 1, candles.length);
  
  // Check subsequent candles for sweep
  for (let i = swingLowIndex + 1; i < endIndex; i++) {
    const candle = candles[i];
    
    // Sweep condition: low goes below swing low, but close is above it
    if (candle.low < swingLow && candle.close > swingLow) {
      return {
        type: 'sweep',
        direction: 'bullish', // Sweep low = bullish signal
        level: swingLow,
        sweepCandle: i,
        wickBelow: swingLow - candle.low,
        closeDistance: candle.close - swingLow,
        strength: (candle.close - candle.low) / (candle.high - candle.low),
        description: 'Liquidity Sweep Below Swing Low'
      };
    }
  }
  
  return null;
}

/**
 * Detect zone boundary sweep
 * Similar to swing sweep but for zone boundaries
 * 
 * @param {Array} candles - Array of candles
 * @param {Object} zone - Zone object with upper/lower/center
 * @param {number} startIndex - Index to start checking from
 * @param {number} lookForward - How many candles forward to check
 * @returns {Object|null} Sweep info or null
 */
function detectZoneSweep(candles, zone, startIndex = 0, lookForward = 5) {
  if (startIndex >= candles.length - 1) return null;
  
  const endIndex = Math.min(startIndex + lookForward + 1, candles.length);
  
  for (let i = startIndex; i < endIndex; i++) {
    const candle = candles[i];
    
    // Check resistance zone sweep (wick above upper bound, close below)
    if (zone.type === 'resistance') {
      if (candle.high > zone.upper && candle.close < zone.upper) {
        return {
          type: 'zone_sweep',
          direction: 'bearish',
          zone: zone,
          level: zone.upper,
          sweepCandle: i,
          wickAbove: candle.high - zone.upper,
          closeDistance: zone.upper - candle.close,
          strength: (candle.high - candle.close) / (candle.high - candle.low),
          description: `Liquidity Sweep Above Resistance Zone`
        };
      }
    }
    
    // Check support zone sweep (wick below lower bound, close above)
    if (zone.type === 'support') {
      if (candle.low < zone.lower && candle.close > zone.lower) {
        return {
          type: 'zone_sweep',
          direction: 'bullish',
          zone: zone,
          level: zone.lower,
          sweepCandle: i,
          wickBelow: zone.lower - candle.low,
          closeDistance: candle.close - zone.lower,
          strength: (candle.close - candle.low) / (candle.high - candle.low),
          description: `Liquidity Sweep Below Support Zone`
        };
      }
    }
  }
  
  return null;
}

/**
 * Detect recent liquidity sweeps from current candle
 * Checks recent swing highs/lows and zones for sweeps
 * 
 * @param {Array} candles - Array of candles
 * @param {Array} pivotHighs - Recent pivot high indices
 * @param {Array} pivotLows - Recent pivot low indices
 * @param {Object} zones - Zones object { support: [], resistance: [] }
 * @param {number} lookback - How many recent pivots/zones to check (default: 5)
 * @returns {Object|null} Most recent sweep or null
 */
function detectRecentSweep(candles, pivotHighs, pivotLows, zones, lookback = 5) {
  if (candles.length < 5) return null;
  
  const currentCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  
  // Check for swing high sweep on current candle
  const recentHighs = pivotHighs.slice(-lookback);
  for (const highIdx of recentHighs.reverse()) {
    if (highIdx < candles.length - 1) {
      const swingHigh = candles[highIdx].high;
      
      // Check if current candle swept it
      if (currentCandle.high > swingHigh && currentCandle.close < swingHigh) {
        return {
          type: 'sweep',
          direction: 'bearish',
          level: swingHigh,
          sweepCandle: candles.length - 1,
          wickAbove: currentCandle.high - swingHigh,
          closeDistance: swingHigh - currentCandle.close,
          strength: (currentCandle.high - currentCandle.close) / (currentCandle.high - currentCandle.low),
          description: 'Liquidity Sweep Above Swing High',
          isCurrent: true
        };
      }
    }
  }
  
  // Check for swing low sweep on current candle
  const recentLows = pivotLows.slice(-lookback);
  for (const lowIdx of recentLows.reverse()) {
    if (lowIdx < candles.length - 1) {
      const swingLow = candles[lowIdx].low;
      
      // Check if current candle swept it
      if (currentCandle.low < swingLow && currentCandle.close > swingLow) {
        return {
          type: 'sweep',
          direction: 'bullish',
          level: swingLow,
          sweepCandle: candles.length - 1,
          wickBelow: swingLow - currentCandle.low,
          closeDistance: currentCandle.close - swingLow,
          strength: (currentCandle.close - currentCandle.low) / (currentCandle.high - currentCandle.low),
          description: 'Liquidity Sweep Below Swing Low',
          isCurrent: true
        };
      }
    }
  }
  
  // Check zone sweeps
  if (zones) {
    // Check resistance zone sweeps
    if (zones.resistance) {
      for (const zone of zones.resistance.slice(-lookback)) {
        if (currentCandle.high > zone.upper && currentCandle.close < zone.upper) {
          return {
            type: 'zone_sweep',
            direction: 'bearish',
            zone: zone,
            level: zone.upper,
            sweepCandle: candles.length - 1,
            wickAbove: currentCandle.high - zone.upper,
            closeDistance: zone.upper - currentCandle.close,
            strength: (currentCandle.high - currentCandle.close) / (currentCandle.high - currentCandle.low),
            description: `Liquidity Sweep Above Resistance Zone`,
            isCurrent: true
          };
        }
      }
    }
    
    // Check support zone sweeps
    if (zones.support) {
      for (const zone of zones.support.slice(-lookback)) {
        if (currentCandle.low < zone.lower && currentCandle.close > zone.lower) {
          return {
            type: 'zone_sweep',
            direction: 'bullish',
            zone: zone,
            level: zone.lower,
            sweepCandle: candles.length - 1,
            wickBelow: zone.lower - currentCandle.low,
            closeDistance: currentCandle.close - zone.lower,
            strength: (currentCandle.close - currentCandle.low) / (currentCandle.high - currentCandle.low),
            description: `Liquidity Sweep Below Support Zone`,
            isCurrent: true
          };
        }
      }
    }
  }
  
  return null;
}

module.exports = {
  detectSwingHighSweep,
  detectSwingLowSweep,
  detectZoneSweep,
  detectRecentSweep
};
