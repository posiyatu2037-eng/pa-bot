/**
 * Cache for klines data organized by symbol and timeframe
 * Supports both closed candles and forming (intrabar) candles
 */
class KlinesCache {
  constructor() {
    // Structure: { symbol: { timeframe: [klines] } }
    this.cache = {};
    // Structure: { symbol: { timeframe: formingCandle } }
    this.formingCandles = {};
  }

  /**
   * Initialize cache for a symbol/timeframe pair
   */
  init(symbol, timeframe, initialKlines = []) {
    if (!this.cache[symbol]) {
      this.cache[symbol] = {};
      this.formingCandles[symbol] = {};
    }
    this.cache[symbol][timeframe] = initialKlines;
    this.formingCandles[symbol][timeframe] = null;
    console.log(`[KlinesCache] Initialized ${symbol} ${timeframe} with ${initialKlines.length} candles`);
  }

  /**
   * Update cache with a new closed candle
   * Replaces the last candle if it has the same openTime, otherwise appends
   * Note: This method also clears the forming candle when a new closed candle arrives
   */
  updateCandle(symbol, timeframe, newCandle) {
    if (!this.cache[symbol] || !this.cache[symbol][timeframe]) {
      console.warn(`[KlinesCache] Cache not initialized for ${symbol} ${timeframe}`);
      return;
    }

    const candles = this.cache[symbol][timeframe];
    
    if (candles.length === 0) {
      candles.push(newCandle);
      return;
    }

    const lastCandle = candles[candles.length - 1];
    
    // If same openTime, replace (update in progress)
    if (lastCandle.openTime === newCandle.openTime) {
      candles[candles.length - 1] = newCandle;
    } else {
      // New candle, append
      candles.push(newCandle);
      
      // Keep cache size reasonable (last 1000 candles)
      if (candles.length > 1000) {
        candles.shift();
      }
    }

    // Clear forming candle when new closed candle arrives
    if (newCandle.isClosed) {
      this.formingCandles[symbol][timeframe] = null;
    }
  }

  /**
   * Update forming (intrabar) candle
   * @param {string} symbol
   * @param {string} timeframe
   * @param {Object} formingCandle - The candle currently forming
   */
  updateFormingCandle(symbol, timeframe, formingCandle) {
    if (!this.formingCandles[symbol]) {
      this.formingCandles[symbol] = {};
    }
    this.formingCandles[symbol][timeframe] = formingCandle;
  }

  /**
   * Get forming (intrabar) candle
   * @param {string} symbol
   * @param {string} timeframe
   * @returns {Object|null} Forming candle or null
   */
  getFormingCandle(symbol, timeframe) {
    if (!this.formingCandles[symbol] || !this.formingCandles[symbol][timeframe]) {
      return null;
    }
    return this.formingCandles[symbol][timeframe];
  }

  /**
   * Get klines for a symbol/timeframe (closed candles only)
   */
  get(symbol, timeframe) {
    if (!this.cache[symbol] || !this.cache[symbol][timeframe]) {
      return [];
    }
    return this.cache[symbol][timeframe];
  }

  /**
   * Get klines including forming candle (for intrabar analysis)
   * @param {string} symbol
   * @param {string} timeframe
   * @returns {Array} Closed candles + forming candle (if exists)
   */
  getWithForming(symbol, timeframe) {
    const closedCandles = this.get(symbol, timeframe);
    const formingCandle = this.getFormingCandle(symbol, timeframe);
    
    if (formingCandle) {
      return [...closedCandles, formingCandle];
    }
    
    return closedCandles;
  }

  /**
   * Get the most recent N candles
   */
  getRecent(symbol, timeframe, count) {
    const candles = this.get(symbol, timeframe);
    return candles.slice(-count);
  }

  /**
   * Get all symbols being cached
   */
  getSymbols() {
    return Object.keys(this.cache);
  }

  /**
   * Get all timeframes for a symbol
   */
  getTimeframes(symbol) {
    if (!this.cache[symbol]) {
      return [];
    }
    return Object.keys(this.cache[symbol]);
  }

  /**
   * Check if cache exists for symbol/timeframe
   */
  has(symbol, timeframe) {
    return this.cache[symbol] && this.cache[symbol][timeframe];
  }
}

module.exports = new KlinesCache();
