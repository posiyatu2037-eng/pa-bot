/**
 * Market Regime Detection Module
 * Determines if market is in trend, range, or expansion mode
 * Uses ATR (volatility), swing structure analysis, and slope
 */

/**
 * Calculate ATR (Average True Range)
 * @param {Array} candles - Array of candles
 * @param {number} period - ATR period (default: 14)
 * @returns {number} ATR value
 */
function calculateATR(candles, period = 14) {
  if (candles.length < period + 1) {
    return 0;
  }

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
  
  // Take last 'period' true ranges and average them
  const recentTRs = trueRanges.slice(-period);
  const atr = recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;
  
  return atr;
}

/**
 * Calculate price slope over a period
 * Returns normalized slope relative to price
 * @param {Array} candles - Array of candles
 * @param {number} period - Period to calculate slope (default: 20)
 * @returns {number} Slope coefficient (-1 to 1 range approx)
 */
function calculateSlope(candles, period = 20) {
  if (candles.length < period) {
    return 0;
  }
  
  const recentCandles = candles.slice(-period);
  const n = recentCandles.length;
  
  // Simple linear regression
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = recentCandles[i].close;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  
  const avgPrice = sumY / n;
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  // Normalize slope by average price to get percentage slope
  const normalizedSlope = (slope / avgPrice) * 100;
  
  return normalizedSlope;
}

/**
 * Analyze swing structure to determine if trending or ranging
 * @param {Array} pivotHighs - Array of pivot high indices
 * @param {Array} pivotLows - Array of pivot low indices
 * @param {Array} candles - Array of candles
 * @returns {string} 'trending_up', 'trending_down', 'ranging'
 */
function analyzeSwingStructure(pivotHighs, pivotLows, candles) {
  if (pivotHighs.length < 3 || pivotLows.length < 3) {
    return 'ranging';
  }
  
  const recentHighs = pivotHighs.slice(-3);
  const recentLows = pivotLows.slice(-3);
  
  // Check for higher highs and higher lows
  const higherHighs = recentHighs.length >= 2 &&
    candles[recentHighs[recentHighs.length - 1]].high > candles[recentHighs[recentHighs.length - 2]].high;
  const higherLows = recentLows.length >= 2 &&
    candles[recentLows[recentLows.length - 1]].low > candles[recentLows[recentLows.length - 2]].low;
  
  // Check for lower highs and lower lows
  const lowerHighs = recentHighs.length >= 2 &&
    candles[recentHighs[recentHighs.length - 1]].high < candles[recentHighs[recentHighs.length - 2]].high;
  const lowerLows = recentLows.length >= 2 &&
    candles[recentLows[recentLows.length - 1]].low < candles[recentLows[recentLows.length - 2]].low;
  
  if (higherHighs && higherLows) {
    return 'trending_up';
  } else if (lowerHighs && lowerLows) {
    return 'trending_down';
  } else {
    return 'ranging';
  }
}

/**
 * Detect market regime
 * @param {Array} candles - Array of candles
 * @param {Array} pivotHighs - Array of pivot high indices
 * @param {Array} pivotLows - Array of pivot low indices
 * @param {Object} config - Configuration { atrPeriod, slopePeriod }
 * @returns {Object} Regime info { regime, atr, atrRatio, slope, structure, confidence }
 */
function detectMarketRegime(candles, pivotHighs, pivotLows, config = {}) {
  const atrPeriod = config.atrPeriod || 14;
  const slopePeriod = config.slopePeriod || 20;
  
  if (candles.length < Math.max(atrPeriod + 1, slopePeriod)) {
    return {
      regime: 'unknown',
      atr: 0,
      atrRatio: 1,
      slope: 0,
      structure: 'ranging',
      confidence: 0
    };
  }
  
  // Calculate current ATR
  const currentATR = calculateATR(candles, atrPeriod);
  
  // Calculate ATR from 50 candles ago for comparison
  const historicalCandles = candles.slice(0, -25);
  const historicalATR = historicalCandles.length >= atrPeriod + 1 
    ? calculateATR(historicalCandles, atrPeriod)
    : currentATR;
  
  // ATR ratio: current / historical (>1.5 = expansion, <0.7 = contraction)
  const atrRatio = historicalATR > 0 ? currentATR / historicalATR : 1;
  
  // Calculate slope
  const slope = calculateSlope(candles, slopePeriod);
  
  // Analyze swing structure
  const structure = analyzeSwingStructure(pivotHighs, pivotLows, candles);
  
  // Determine regime
  let regime = 'range';
  let confidence = 0.5;
  
  // Expansion: High volatility increase
  if (atrRatio > 1.5) {
    regime = 'expansion';
    confidence = Math.min((atrRatio - 1) / 1, 1); // 0.5 to 1
  }
  // Trending: Strong slope + trending structure
  else if (Math.abs(slope) > 0.3 && structure !== 'ranging') {
    if (structure === 'trending_up') {
      regime = 'trend_up';
      confidence = Math.min(Math.abs(slope) / 1, 1);
    } else {
      regime = 'trend_down';
      confidence = Math.min(Math.abs(slope) / 1, 1);
    }
  }
  // Range: Low volatility, weak slope, ranging structure
  else if (atrRatio < 0.8 && Math.abs(slope) < 0.2) {
    regime = 'range';
    confidence = 1 - Math.abs(slope) / 0.5;
  }
  // Mixed: Could be transitioning
  else {
    regime = structure === 'trending_up' ? 'trend_up' : 
             structure === 'trending_down' ? 'trend_down' : 'range';
    confidence = 0.4; // Lower confidence in mixed signals
  }
  
  return {
    regime,
    atr: currentATR,
    atrRatio,
    slope,
    structure,
    confidence: Math.max(0.3, Math.min(confidence, 1))
  };
}

/**
 * Get simple regime name for display
 * @param {string} regime - Regime type
 * @returns {string} Display name
 */
function getRegimeDisplayName(regime) {
  const names = {
    'trend_up': 'Xu hướng tăng',
    'trend_down': 'Xu hướng giảm',
    'range': 'Sideway',
    'expansion': 'Bùng nổ',
    'unknown': 'Chưa rõ'
  };
  return names[regime] || regime;
}

module.exports = {
  detectMarketRegime,
  calculateATR,
  calculateSlope,
  analyzeSwingStructure,
  getRegimeDisplayName
};
