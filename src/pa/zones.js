const { getRecentPivotHighs, getRecentPivotLows } = require('./pivots');

/**
 * Build support and resistance zones from pivot points
 */

/**
 * Create a zone from a pivot point
 * @param {number} price - Zone center price
 * @param {number} tolerance - Tolerance percentage (e.g., 0.5 for 0.5%)
 * @returns {Object} Zone object
 */
function createZone(price, tolerance, type, timestamp) {
  const toleranceAmount = price * (tolerance / 100);
  return {
    center: price,
    upper: price + toleranceAmount,
    lower: price - toleranceAmount,
    type, // 'support' or 'resistance'
    timestamp,
    touches: 0,
    key: `${type}_${price.toFixed(2)}`
  };
}

/**
 * Build zones from pivot points
 * @param {Array} candles - Array of candles
 * @param {number} lookback - How many candles to look back (default: 100)
 * @param {number} window - Pivot detection window
 * @param {number} tolerance - Zone tolerance percentage
 * @returns {Object} { support: [], resistance: [] }
 */
function buildZones(candles, lookback = 100, window = 5, tolerance = 0.5) {
  const recentCandles = candles.slice(-lookback);
  
  const pivotHighIndices = getRecentPivotHighs(recentCandles, window, 20);
  const pivotLowIndices = getRecentPivotLows(recentCandles, window, 20);

  const resistanceZones = [];
  const supportZones = [];

  // Build resistance zones from pivot highs
  for (const idx of pivotHighIndices) {
    const candle = recentCandles[idx];
    const zone = createZone(candle.high, tolerance, 'resistance', candle.openTime);
    resistanceZones.push(zone);
  }

  // Build support zones from pivot lows
  for (const idx of pivotLowIndices) {
    const candle = recentCandles[idx];
    const zone = createZone(candle.low, tolerance, 'support', candle.openTime);
    supportZones.push(zone);
  }

  // Merge nearby zones (within 2x tolerance)
  const mergedResistance = mergeNearbyZones(resistanceZones, tolerance * 2);
  const mergedSupport = mergeNearbyZones(supportZones, tolerance * 2);

  return {
    resistance: mergedResistance,
    support: mergedSupport
  };
}

/**
 * Merge nearby zones to reduce noise
 */
function mergeNearbyZones(zones, mergeThreshold) {
  if (zones.length === 0) return [];

  // Sort by center price
  const sorted = zones.sort((a, b) => a.center - b.center);
  const merged = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const lastMerged = merged[merged.length - 1];
    const current = sorted[i];
    
    const priceDiff = Math.abs(current.center - lastMerged.center);
    const avgPrice = (current.center + lastMerged.center) / 2;
    const diffPercent = (priceDiff / avgPrice) * 100;

    if (diffPercent <= mergeThreshold) {
      // Merge: average the centers and adjust bounds
      lastMerged.center = (lastMerged.center + current.center) / 2;
      lastMerged.upper = Math.max(lastMerged.upper, current.upper);
      lastMerged.lower = Math.min(lastMerged.lower, current.lower);
      lastMerged.touches += current.touches;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Check if price is touching/near a zone
 * @param {number} price - Current price
 * @param {Object} zone - Zone object
 * @returns {boolean}
 */
function isTouchingZone(price, zone) {
  return price >= zone.lower && price <= zone.upper;
}

/**
 * Find nearest zone to current price
 * @param {number} price - Current price
 * @param {Array} zones - Array of zones
 * @param {number} maxDistance - Max distance percentage to consider (default: 2%)
 * @returns {Object|null} Nearest zone or null
 */
function findNearestZone(price, zones, maxDistance = 2) {
  let nearest = null;
  let minDistance = Infinity;

  for (const zone of zones) {
    const distance = Math.abs(price - zone.center);
    const distancePercent = (distance / price) * 100;

    if (distancePercent <= maxDistance && distance < minDistance) {
      minDistance = distance;
      nearest = zone;
    }
  }

  return nearest;
}

/**
 * Detect if price is retesting a zone after breakout
 * @param {Array} candles - Recent candles
 * @param {Object} zone - Zone to check
 * @param {string} direction - 'up' or 'down' (breakout direction)
 * @returns {boolean}
 */
function isRetesting(candles, zone, direction) {
  if (candles.length < 3) return false;

  const currentPrice = candles[candles.length - 1].close;
  
  if (direction === 'up') {
    // After breakout above resistance, price should be above zone but touching upper bound
    return currentPrice >= zone.center && isTouchingZone(currentPrice, zone);
  } else if (direction === 'down') {
    // After breakout below support, price should be below zone but touching lower bound
    return currentPrice <= zone.center && isTouchingZone(currentPrice, zone);
  }

  return false;
}

/**
 * Find next opposing zones for take profit targets
 * @param {number} entryPrice - Entry price
 * @param {Array} zones - Array of opposing zones (resistance for longs, support for shorts)
 * @param {string} side - 'LONG' or 'SHORT'
 * @param {number} maxTargets - Maximum number of targets to return (default: 2)
 * @returns {Array} Array of zone objects sorted by distance from entry
 */
function findNextOpposingZones(entryPrice, zones, side, maxTargets = 2) {
  const opposingZones = [];
  
  for (const zone of zones) {
    if (side === 'LONG') {
      // For longs, find resistance zones above entry
      if (zone.center > entryPrice) {
        opposingZones.push({
          ...zone,
          distance: zone.center - entryPrice,
          distancePercent: ((zone.center - entryPrice) / entryPrice) * 100
        });
      }
    } else if (side === 'SHORT') {
      // For shorts, find support zones below entry
      if (zone.center < entryPrice) {
        opposingZones.push({
          ...zone,
          distance: entryPrice - zone.center,
          distancePercent: ((entryPrice - zone.center) / entryPrice) * 100
        });
      }
    }
  }
  
  // Sort by distance (closest first)
  opposingZones.sort((a, b) => a.distance - b.distance);
  
  // Return up to maxTargets zones
  return opposingZones.slice(0, maxTargets);
}

/**
 * Find stop loss zone
 * @param {number} entryPrice - Entry price
 * @param {Array} zones - Array of zones (support for longs, resistance for shorts)
 * @param {string} side - 'LONG' or 'SHORT'
 * @returns {Object|null} Stop loss zone or null
 */
function findStopLossZone(entryPrice, zones, side) {
  // Find the nearest zone in the opposite direction of trade
  let slZone = null;
  let minDistance = Infinity;
  
  for (const zone of zones) {
    if (side === 'LONG') {
      // For longs, find support zone below entry
      if (zone.center < entryPrice) {
        const distance = entryPrice - zone.center;
        if (distance < minDistance) {
          minDistance = distance;
          slZone = zone;
        }
      }
    } else if (side === 'SHORT') {
      // For shorts, find resistance zone above entry
      if (zone.center > entryPrice) {
        const distance = zone.center - entryPrice;
        if (distance < minDistance) {
          minDistance = distance;
          slZone = zone;
        }
      }
    }
  }
  
  return slZone;
}

module.exports = {
  buildZones,
  createZone,
  isTouchingZone,
  findNearestZone,
  isRetesting,
  mergeNearbyZones,
  findNextOpposingZones,
  findStopLossZone
};
