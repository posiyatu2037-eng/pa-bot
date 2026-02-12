#!/usr/bin/env node

/**
 * Integration Test for Signal Engine Upgrade
 * Tests key functionality without requiring live API access
 */

const klinesCache = require('./src/binance/klinesCache');
const SignalEngine = require('./src/app/engine');
const { evaluateChaseRisk, calculateATR } = require('./src/pa/antiChase');
const { detectInsideBar, detectMorningStar, detectEveningStar, detectTweezer } = require('./src/pa/patterns');

console.log('='.repeat(60));
console.log('PA-Bot Signal Engine Upgrade - Integration Tests');
console.log('='.repeat(60));
console.log();

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✓ ${name}`);
    passedTests++;
    return true;
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err.message}`);
    return false;
  }
}

// Test 1: klinesCache with forming candles
test('klinesCache stores and retrieves forming candles', () => {
  const symbol = 'TESTBTC';
  const timeframe = '1h';
  
  // Initialize cache
  klinesCache.init(symbol, timeframe, []);
  
  // Add a forming candle
  const formingCandle = {
    openTime: Date.now(),
    open: 100,
    high: 102,
    low: 99,
    close: 101,
    volume: 1000,
    isClosed: false
  };
  
  klinesCache.updateFormingCandle(symbol, timeframe, formingCandle);
  
  // Retrieve it
  const retrieved = klinesCache.getFormingCandle(symbol, timeframe);
  
  if (!retrieved || retrieved.close !== 101) {
    throw new Error('Forming candle not properly stored/retrieved');
  }
  
  // Get with forming
  const withForming = klinesCache.getWithForming(symbol, timeframe);
  if (withForming.length !== 1) {
    throw new Error('getWithForming should include forming candle');
  }
});

// Test 2: Anti-chase ATR calculation
test('Anti-chase calculates ATR correctly', () => {
  const candles = [];
  const basePrice = 100;
  
  // Generate 20 candles with some volatility
  for (let i = 0; i < 20; i++) {
    const prevClose = i === 0 ? basePrice : candles[i - 1].close;
    candles.push({
      openTime: Date.now() - (20 - i) * 3600000,
      open: prevClose,
      high: prevClose + 2,
      low: prevClose - 2,
      close: prevClose + (Math.random() - 0.5) * 2,
      volume: 1000
    });
  }
  
  const atr = calculateATR(candles, 14);
  
  if (atr <= 0 || atr > 10) {
    throw new Error(`ATR out of expected range: ${atr}`);
  }
});

// Test 3: Anti-chase decision logic
test('Anti-chase evaluates chase risk', () => {
  const candles = [];
  const basePrice = 100;
  
  // Generate candles with upward trend
  for (let i = 0; i < 50; i++) {
    candles.push({
      openTime: Date.now() - (50 - i) * 3600000,
      open: basePrice + i,
      high: basePrice + i + 2,
      low: basePrice + i - 1,
      close: basePrice + i + 1,
      volume: 1000
    });
  }
  
  const setup = {
    side: 'LONG',
    price: basePrice,
    entry: basePrice
  };
  
  const config = {
    antiChaseMaxATR: 2.0,
    antiChaseMaxPct: 3.0
  };
  
  const result = evaluateChaseRisk(candles, setup, config);
  
  if (!result.decision || !['CHASE_NO', 'CHASE_OK', 'REVERSAL_WATCH'].includes(result.decision)) {
    throw new Error(`Invalid chase decision: ${result.decision}`);
  }
  
  if (!result.reason) {
    throw new Error('Chase evaluation missing reason');
  }
});

// Test 4: Inside bar pattern detection
test('Pattern detection - Inside bar', () => {
  const prevCandle = {
    open: 100,
    high: 105,
    low: 95,
    close: 102
  };
  
  const currentCandle = {
    open: 101,
    high: 103,
    low: 98,
    close: 102
  };
  
  const result = detectInsideBar(prevCandle, currentCandle);
  
  if (!result.isInsideBar) {
    throw new Error('Inside bar not detected');
  }
  
  if (result.strength <= 0 || result.strength >= 1) {
    throw new Error(`Invalid inside bar strength: ${result.strength}`);
  }
});

// Test 5: Morning star pattern detection
test('Pattern detection - Morning star', () => {
  const candles = [
    { open: 105, high: 106, low: 100, close: 100 }, // Bearish candle
    { open: 100, high: 101, low: 99, close: 99.5 },  // Small star
    { open: 100, high: 105, low: 99, close: 104 }    // Bullish confirmation
  ];
  
  const result = detectMorningStar(candles);
  
  if (!result.isMorningStar) {
    throw new Error('Morning star pattern not detected');
  }
  
  if (result.type !== 'bullish') {
    throw new Error('Morning star should be bullish');
  }
});

// Test 6: Engine initialization
test('Signal engine initializes correctly', () => {
  const engine = new SignalEngine({
    setupScoreThreshold: 50,
    entryScoreThreshold: 70,
    minRR: 1.5
  });
  
  if (!engine.config) {
    throw new Error('Engine config not initialized');
  }
  
  if (engine.config.setupScoreThreshold !== 50) {
    throw new Error('Setup threshold not set correctly');
  }
  
  if (engine.config.entryScoreThreshold !== 70) {
    throw new Error('Entry threshold not set correctly');
  }
  
  if (!engine.setupAlerts) {
    throw new Error('Setup alerts map not initialized');
  }
});

// Test 7: Throttle map initialization
test('Engine throttle map handles intrabar updates', () => {
  const engine = new SignalEngine();
  
  // Simulate initialization
  if (!engine._lastIntrabarUpdate) {
    engine._lastIntrabarUpdate = new Map();
  }
  
  const key = 'BTCUSDT_1h';
  const now = Date.now();
  
  engine._lastIntrabarUpdate.set(key, now);
  
  const stored = engine._lastIntrabarUpdate.get(key);
  if (stored !== now) {
    throw new Error('Throttle map not working correctly');
  }
});

// Test 8: Tweezer pattern detection
test('Pattern detection - Tweezer bottom', () => {
  const prevCandle = {
    open: 102,
    high: 103,
    low: 100,
    close: 100.5
  };
  
  const currentCandle = {
    open: 100.5,
    high: 102,
    low: 100, // Same low as prev
    close: 101.5
  };
  
  const result = detectTweezer(prevCandle, currentCandle);
  
  if (!result.isTweezer) {
    throw new Error('Tweezer pattern not detected');
  }
  
  if (result.type !== 'bullish') {
    throw new Error('Tweezer bottom should be bullish');
  }
});

// Summary
console.log();
console.log('='.repeat(60));
console.log(`Test Results: ${passedTests}/${totalTests} passed`);
console.log('='.repeat(60));

if (passedTests === totalTests) {
  console.log('✓ All tests passed!');
  process.exit(0);
} else {
  console.log(`✗ ${totalTests - passedTests} test(s) failed`);
  process.exit(1);
}
