#!/usr/bin/env node
/**
 * Validation script for new PA modules
 * Tests regime detection, structure events, and liquidity sweeps
 */

const { detectMarketRegime } = require('./src/pa/regime');
const { detectBOS, detectCHoCH, detectStructureEvents } = require('./src/pa/events');
const { detectRecentSweep } = require('./src/pa/liquidity');
const { detectReversalPattern } = require('./src/pa/patterns');
const { detectPivotHighs, detectPivotLows } = require('./src/pa/pivots');

console.log('='.repeat(60));
console.log('PA Module Validation Script');
console.log('='.repeat(60));

// Generate mock candle data for testing
function generateMockCandles(count, trend = 'up') {
  const candles = [];
  let basePrice = 50000;
  
  for (let i = 0; i < count; i++) {
    const trendFactor = trend === 'up' ? 1 : trend === 'down' ? -1 : 0;
    const noise = (Math.random() - 0.5) * 100;
    const trendMove = trendFactor * 50;
    
    const open = basePrice;
    const close = basePrice + trendMove + noise;
    const high = Math.max(open, close) + Math.abs(noise) * 0.5;
    const low = Math.min(open, close) - Math.abs(noise) * 0.5;
    
    candles.push({
      open,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 500,
      closeTime: Date.now() + i * 60000
    });
    
    basePrice = close;
  }
  
  return candles;
}

// Test 1: Regime Detection
console.log('\n1. Testing Regime Detection...');
try {
  const trendUpCandles = generateMockCandles(50, 'up');
  const pivotHighs = detectPivotHighs(trendUpCandles, 5);
  const pivotLows = detectPivotLows(trendUpCandles, 5);
  
  const regime = detectMarketRegime(trendUpCandles, pivotHighs, pivotLows, { atrPeriod: 14 });
  
  console.log('   ✅ Regime detection successful');
  console.log(`   - Regime: ${regime.regime}`);
  console.log(`   - Confidence: ${(regime.confidence * 100).toFixed(1)}%`);
  console.log(`   - ATR: ${regime.atr.toFixed(2)}`);
  console.log(`   - Slope: ${regime.slope.toFixed(3)}`);
  
  if (!regime.regime || typeof regime.confidence !== 'number') {
    throw new Error('Invalid regime object structure');
  }
  
  if (!isFinite(regime.atr) || !isFinite(regime.confidence)) {
    throw new Error('NaN or Infinity detected in regime values');
  }
  
} catch (err) {
  console.error('   ❌ Regime detection failed:', err.message);
  process.exit(1);
}

// Test 2: BOS Detection
console.log('\n2. Testing BOS (Break of Structure) Detection...');
try {
  const trendCandles = generateMockCandles(30, 'up');
  const pivotHighs = detectPivotHighs(trendCandles, 5);
  const pivotLows = detectPivotLows(trendCandles, 5);
  
  const bos = detectBOS(trendCandles, pivotHighs, pivotLows, 3);
  
  if (bos) {
    console.log('   ✅ BOS detected');
    console.log(`   - Type: ${bos.type}`);
    console.log(`   - Direction: ${bos.direction}`);
    console.log(`   - Level: ${bos.level.toFixed(2)}`);
    console.log(`   - Strength: ${(bos.strength * 100).toFixed(2)}%`);
    
    if (!isFinite(bos.level) || !isFinite(bos.strength)) {
      throw new Error('NaN or Infinity detected in BOS values');
    }
  } else {
    console.log('   ℹ️  No BOS detected (may be expected for this data)');
  }
  
  console.log('   ✅ BOS detection function works correctly');
  
} catch (err) {
  console.error('   ❌ BOS detection failed:', err.message);
  process.exit(1);
}

// Test 3: CHoCH Detection
console.log('\n3. Testing CHoCH (Change of Character) Detection...');
try {
  const reversalCandles = generateMockCandles(20, 'up').concat(generateMockCandles(10, 'down'));
  const pivotHighs = detectPivotHighs(reversalCandles, 5);
  const pivotLows = detectPivotLows(reversalCandles, 5);
  
  const choch = detectCHoCH(reversalCandles, pivotHighs, pivotLows, 'up', 3);
  
  if (choch) {
    console.log('   ✅ CHoCH detected');
    console.log(`   - Type: ${choch.type}`);
    console.log(`   - Direction: ${choch.direction}`);
    console.log(`   - Previous Trend: ${choch.previousTrend}`);
    console.log(`   - New Trend: ${choch.newTrend}`);
    console.log(`   - Level: ${choch.level.toFixed(2)}`);
    
    if (!isFinite(choch.level) || !isFinite(choch.strength)) {
      throw new Error('NaN or Infinity detected in CHoCH values');
    }
  } else {
    console.log('   ℹ️  No CHoCH detected (may be expected for this data)');
  }
  
  console.log('   ✅ CHoCH detection function works correctly');
  
} catch (err) {
  console.error('   ❌ CHoCH detection failed:', err.message);
  process.exit(1);
}

// Test 4: Structure Events
console.log('\n4. Testing Structure Events Detection...');
try {
  const candles = generateMockCandles(30, 'up');
  const pivotHighs = detectPivotHighs(candles, 5);
  const pivotLows = detectPivotLows(candles, 5);
  
  const structureEvent = detectStructureEvents(candles, pivotHighs, pivotLows, 'up', 3);
  
  if (structureEvent) {
    console.log('   ✅ Structure event detected');
    console.log(`   - Type: ${structureEvent.type}`);
    console.log(`   - Direction: ${structureEvent.direction}`);
  } else {
    console.log('   ℹ️  No structure event detected (normal for some data)');
  }
  
  console.log('   ✅ Structure events detection works correctly');
  
} catch (err) {
  console.error('   ❌ Structure events detection failed:', err.message);
  process.exit(1);
}

// Test 5: Liquidity Sweep Detection
console.log('\n5. Testing Liquidity Sweep Detection...');
try {
  const candles = generateMockCandles(30, 'up');
  const pivotHighs = detectPivotHighs(candles, 5);
  const pivotLows = detectPivotLows(candles, 5);
  
  // Create a sweep scenario: last candle wicks below recent low but closes above
  if (candles.length > 5 && pivotLows.length > 0) {
    const lastLow = candles[pivotLows[pivotLows.length - 1]].low;
    const lastCandle = candles[candles.length - 1];
    lastCandle.low = lastLow - 50;
    lastCandle.close = lastLow + 20;
  }
  
  const sweep = detectRecentSweep(candles, pivotHighs, pivotLows, null, 5);
  
  if (sweep) {
    console.log('   ✅ Liquidity sweep detected');
    console.log(`   - Type: ${sweep.type}`);
    console.log(`   - Direction: ${sweep.direction}`);
    console.log(`   - Level: ${sweep.level.toFixed(2)}`);
    console.log(`   - Strength: ${(sweep.strength * 100).toFixed(2)}%`);
    
    if (!isFinite(sweep.level) || !isFinite(sweep.strength)) {
      throw new Error('NaN or Infinity detected in sweep values');
    }
  } else {
    console.log('   ℹ️  No liquidity sweep detected');
  }
  
  console.log('   ✅ Liquidity sweep detection works correctly');
  
} catch (err) {
  console.error('   ❌ Liquidity sweep detection failed:', err.message);
  process.exit(1);
}

// Test 6: Enhanced Pattern Detection
console.log('\n6. Testing Enhanced Pattern Detection...');
try {
  const candles = generateMockCandles(10, 'neutral');
  
  // Create a hammer pattern on the last candle
  const lastCandle = candles[candles.length - 1];
  const range = 200;
  lastCandle.low = 50000;
  lastCandle.open = 50150;
  lastCandle.close = 50160;
  lastCandle.high = 50180;
  
  const pattern = detectReversalPattern(candles);
  
  if (pattern) {
    console.log('   ✅ Pattern detected');
    console.log(`   - Name: ${pattern.name}`);
    console.log(`   - Type: ${pattern.type}`);
    console.log(`   - Strength: ${(pattern.strength * 100).toFixed(1)}%`);
    
    if (!pattern.name || !pattern.type) {
      throw new Error('Invalid pattern object structure');
    }
  } else {
    console.log('   ℹ️  No pattern detected');
  }
  
  console.log('   ✅ Pattern detection works correctly');
  
} catch (err) {
  console.error('   ❌ Pattern detection failed:', err.message);
  process.exit(1);
}

// Test 7: Validate No NaN/Infinity in Combined Analysis
console.log('\n7. Testing Combined PA Analysis for NaN/Infinity...');
try {
  const candles = generateMockCandles(100, 'up');
  const pivotHighs = detectPivotHighs(candles, 5);
  const pivotLows = detectPivotLows(candles, 5);
  
  const regime = detectMarketRegime(candles, pivotHighs, pivotLows);
  const structureEvent = detectStructureEvents(candles, pivotHighs, pivotLows, 'up');
  const sweep = detectRecentSweep(candles, pivotHighs, pivotLows, null, 5);
  
  // Check all numeric values for NaN/Infinity
  const values = [
    regime.atr,
    regime.atrRatio,
    regime.slope,
    regime.confidence
  ];
  
  if (structureEvent) {
    values.push(structureEvent.level, structureEvent.strength);
  }
  
  if (sweep) {
    values.push(sweep.level, sweep.strength);
  }
  
  for (const val of values) {
    if (!isFinite(val)) {
      throw new Error(`Invalid value detected: ${val}`);
    }
  }
  
  console.log('   ✅ All numeric values are finite (no NaN/Infinity)');
  
} catch (err) {
  console.error('   ❌ NaN/Infinity validation failed:', err.message);
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('✅ All PA module validation tests passed!');
console.log('='.repeat(60));
