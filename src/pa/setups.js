const { detectReversalPattern, getCandleStrength } = require('./patterns');
const { buildZones, isTouchingZone, findNearestZone } = require('./zones');

/**
 * Detect trading setups based on price action
 */

/**
 * Calculate average volume over last N candles
 */
function calculateAverageVolume(candles, period = 20) {
  if (candles.length < period) {
    period = candles.length;
  }
  
  const recentCandles = candles.slice(-period);
  const totalVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0);
  return totalVolume / period;
}

/**
 * Check for volume spike
 */
function hasVolumeSpark(currentVolume, avgVolume, threshold = 1.5) {
  return currentVolume > avgVolume * threshold;
}

/**
 * Detect reversal setup at support/resistance zone
 * @param {Array} candles - Array of candles
 * @param {Object} zones - { support: [], resistance: [] }
 * @param {Object} config - Configuration
 * @returns {Object|null} Setup info or null
 */
function detectReversalSetup(candles, zones, config = {}) {
  if (candles.length < 20) return null;

  const currentCandle = candles[candles.length - 1];
  const currentPrice = currentCandle.close;

  // Check for reversal pattern
  const pattern = detectReversalPattern(candles);
  if (!pattern) return null;

  // Check if near support (for bullish reversal) or resistance (for bearish reversal)
  if (pattern.type === 'bullish') {
    const nearestSupport = findNearestZone(currentPrice, zones.support, 1);
    if (nearestSupport && isTouchingZone(currentPrice, nearestSupport)) {
      return {
        type: 'reversal',
        side: 'LONG',
        pattern,
        zone: nearestSupport,
        price: currentPrice,
        name: 'Bullish Reversal at Support'
      };
    }
  } else if (pattern.type === 'bearish') {
    const nearestResistance = findNearestZone(currentPrice, zones.resistance, 1);
    if (nearestResistance && isTouchingZone(currentPrice, nearestResistance)) {
      return {
        type: 'reversal',
        side: 'SHORT',
        pattern,
        zone: nearestResistance,
        price: currentPrice,
        name: 'Bearish Reversal at Resistance'
      };
    }
  }

  return null;
}

/**
 * Detect breakout/breakdown setup
 * True breakout: close outside zone + volume spike
 * False breakout: wick beyond zone but close back inside + weak volume
 */
function detectBreakoutSetup(candles, zones, config = {}) {
  if (candles.length < 20) return null;

  const currentCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  const currentPrice = currentCandle.close;

  const avgVolume = calculateAverageVolume(candles, 20);
  const volumeSpike = hasVolumeSpark(currentCandle.volume, avgVolume, config.volumeSpikeThreshold || 1.5);

  // Check resistance breakout
  for (const zone of zones.resistance) {
    const prevBelowZone = prevCandle.close < zone.center;
    const currentAboveZone = currentCandle.close > zone.upper;

    if (prevBelowZone && currentAboveZone) {
      // True breakout
      if (volumeSpike) {
        return {
          type: 'breakout',
          side: 'LONG',
          zone,
          price: currentPrice,
          volumeSpike: true,
          volumeRatio: currentCandle.volume / avgVolume,
          name: 'True Breakout Above Resistance',
          isTrue: true
        };
      } else {
        // Potential false breakout (weak volume)
        return {
          type: 'breakout',
          side: 'SHORT', // Fade the breakout
          zone,
          price: currentPrice,
          volumeSpike: false,
          volumeRatio: currentCandle.volume / avgVolume,
          name: 'False Breakout (Weak Volume)',
          isTrue: false
        };
      }
    }

    // Check for false breakout: wick above but close back inside
    const wickAbove = currentCandle.high > zone.upper;
    const closedInside = currentCandle.close < zone.upper;
    if (wickAbove && closedInside && !volumeSpike) {
      return {
        type: 'false_breakout',
        side: 'SHORT',
        zone,
        price: currentPrice,
        volumeSpike: false,
        volumeRatio: currentCandle.volume / avgVolume,
        name: 'False Breakout Rejection',
        isTrue: false
      };
    }
  }

  // Check support breakdown
  for (const zone of zones.support) {
    const prevAboveZone = prevCandle.close > zone.center;
    const currentBelowZone = currentCandle.close < zone.lower;

    if (prevAboveZone && currentBelowZone) {
      // True breakdown
      if (volumeSpike) {
        return {
          type: 'breakdown',
          side: 'SHORT',
          zone,
          price: currentPrice,
          volumeSpike: true,
          volumeRatio: currentCandle.volume / avgVolume,
          name: 'True Breakdown Below Support',
          isTrue: true
        };
      } else {
        // Potential false breakdown
        return {
          type: 'breakdown',
          side: 'LONG', // Fade the breakdown
          zone,
          price: currentPrice,
          volumeSpike: false,
          volumeRatio: currentCandle.volume / avgVolume,
          name: 'False Breakdown (Weak Volume)',
          isTrue: false
        };
      }
    }

    // Check for false breakdown: wick below but close back inside
    const wickBelow = currentCandle.low < zone.lower;
    const closedInside = currentCandle.close > zone.lower;
    if (wickBelow && closedInside && !volumeSpike) {
      return {
        type: 'false_breakdown',
        side: 'LONG',
        zone,
        price: currentPrice,
        volumeSpike: false,
        volumeRatio: currentCandle.volume / avgVolume,
        name: 'False Breakdown Rejection',
        isTrue: false
      };
    }
  }

  return null;
}

/**
 * Detect retest setup after breakout
 */
function detectRetestSetup(candles, zones, config = {}) {
  if (candles.length < 30) return null;

  const currentCandle = candles[candles.length - 1];
  const currentPrice = currentCandle.close;

  // Look for recent breakout (in last 10-20 candles)
  const recentCandles = candles.slice(-20);
  
  // Check if we're retesting a broken resistance (now support)
  for (const zone of zones.resistance) {
    const aboveZone = currentPrice > zone.center;
    const touching = isTouchingZone(currentPrice, zone);

    if (aboveZone && touching) {
      // Check if there was a breakout in recent history
      const hadBreakout = recentCandles.some(c => c.close > zone.upper);
      if (hadBreakout) {
        const pattern = detectReversalPattern(candles);
        if (pattern && pattern.type === 'bullish') {
          return {
            type: 'retest',
            side: 'LONG',
            zone,
            price: currentPrice,
            pattern,
            name: 'Retest of Broken Resistance'
          };
        }
      }
    }
  }

  // Check if we're retesting a broken support (now resistance)
  for (const zone of zones.support) {
    const belowZone = currentPrice < zone.center;
    const touching = isTouchingZone(currentPrice, zone);

    if (belowZone && touching) {
      const hadBreakdown = recentCandles.some(c => c.close < zone.lower);
      if (hadBreakdown) {
        const pattern = detectReversalPattern(candles);
        if (pattern && pattern.type === 'bearish') {
          return {
            type: 'retest',
            side: 'SHORT',
            zone,
            price: currentPrice,
            pattern,
            name: 'Retest of Broken Support'
          };
        }
      }
    }
  }

  return null;
}

/**
 * Detect any setup
 */
function detectSetup(candles, config = {}) {
  const zones = buildZones(
    candles,
    config.zoneLookback || 100,
    config.pivotWindow || 5,
    config.zoneTolerance || 0.5
  );

  // Validate zones exist
  const minZonesRequired = config.minZonesRequired || 2;
  const totalZones = zones.support.length + zones.resistance.length;
  
  if (totalZones < minZonesRequired) {
    console.log(`[Setup] Insufficient zones: ${totalZones} zones found, minimum ${minZonesRequired} required. Skipping signal.`);
    return null;
  }

  // Try reversal first
  let setup = detectReversalSetup(candles, zones, config);
  if (setup) {
    setup.zones = zones; // Attach all zones for SL/TP calculation
    return setup;
  }

  // Try breakout
  setup = detectBreakoutSetup(candles, zones, config);
  if (setup) {
    setup.zones = zones; // Attach all zones for SL/TP calculation
    return setup;
  }

  // Try retest
  setup = detectRetestSetup(candles, zones, config);
  if (setup) {
    setup.zones = zones; // Attach all zones for SL/TP calculation
    return setup;
  }

  return null;
}

module.exports = {
  detectReversalSetup,
  detectBreakoutSetup,
  detectRetestSetup,
  detectSetup,
  calculateAverageVolume,
  hasVolumeSpark
};
