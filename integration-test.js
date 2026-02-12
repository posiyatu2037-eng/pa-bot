#!/usr/bin/env node
/**
 * Simple integration test to verify core modules work together
 */

const { detectSetup } = require('./src/pa/setups');
const { calculateScore, calculateLevels } = require('./src/pa/score');
const { getCandleStrength, detectReversalPattern } = require('./src/pa/patterns');
const { buildZones } = require('./src/pa/zones');
const { analyzeMarketStructure, determineHTFBias } = require('./src/pa/structure');
const { detectMarketRegime } = require('./src/pa/regime');
const { detectStructureEvents } = require('./src/pa/events');
const { detectRecentSweep } = require('./src/pa/liquidity');
const { detectPivotHighs, detectPivotLows } = require('./src/pa/pivots');

console.log('Testing core PA-Bot modules...\n');

// Generate sample candles
function generateCandles(count = 100) {
  const candles = [];
  let price = 50000;
  
  for (let i = 0; i < count; i++) {
    const open = price + (Math.random() - 0.5) * 500;
    const close = open + (Math.random() - 0.5) * 400;
    const high = Math.max(open, close) + Math.random() * 150;
    const low = Math.min(open, close) - Math.random() * 150;
    
    candles.push({
      openTime: Date.now() - (count - i) * 3600000,
      open,
      high,
      low,
      close,
      volume: 1000 + Math.random() * 500,
      closeTime: Date.now() - (count - i - 1) * 3600000
    });
    
    price = close;
  }
  
  return candles;
}

try {
  // Test 1: Pattern detection
  console.log('✓ Test 1: Pattern Detection');
  const candles = generateCandles(100);
  const pattern = detectReversalPattern(candles);
  console.log(`  Pattern: ${pattern ? pattern.name : 'None'}`);
  
  // Test 2: Zone building
  console.log('\n✓ Test 2: Zone Building');
  const zones = buildZones(candles, 100, 5, 0.5);
  console.log(`  Support zones: ${zones.support.length}`);
  console.log(`  Resistance zones: ${zones.resistance.length}`);
  
  // Test 3: Market structure
  console.log('\n✓ Test 3: Market Structure Analysis');
  const structure1d = analyzeMarketStructure(candles, 5);
  console.log(`  1d structure: ${structure1d}`);
  
  const htfBias = determineHTFBias({ '1d': structure1d, '4h': 'up' });
  console.log(`  HTF bias: ${htfBias.bias} (score: ${htfBias.score})`);
  
  // Test 4: Setup detection
  console.log('\n✓ Test 4: Setup Detection');
  const config = {
    pivotWindow: 5,
    zoneLookback: 100,
    zoneTolerance: 0.5,
    volumeSpikeThreshold: 1.5,
    minZonesRequired: 2
  };
  const setup = detectSetup(candles, config);
  console.log(`  Setup: ${setup ? setup.name : 'None detected'}`);
  
  if (setup) {
    // Test 5: Scoring
    console.log('\n✓ Test 5: Signal Scoring');
    const htfAlignment = { aligned: true, score: 1.0 };
    const divergence = null;
    const scoreResult = calculateScore(setup, htfAlignment, candles, divergence);
    console.log(`  Score: ${scoreResult.score}/${scoreResult.maxScore}`);
    console.log(`  Breakdown:`, scoreResult.breakdown);
    
    // Test 6: Level calculation
    console.log('\n✓ Test 6: Zone-based Level Calculation');
    const levels = calculateLevels(setup, 0.2);
    console.log(`  Entry: ${levels.entry.toFixed(2)}`);
    console.log(`  Stop Loss: ${levels.stopLoss.toFixed(2)}${levels.slZone ? ` (${levels.slZone.type})` : ''}`);
    console.log(`  TP1: ${levels.takeProfit1.toFixed(2)} (${levels.riskReward1}R)${levels.tpZones[0] ? ` [${levels.tpZones[0].type}]` : ''}`);
    console.log(`  TP2: ${levels.takeProfit2.toFixed(2)} (${levels.riskReward2}R)${levels.tpZones[1] ? ` [${levels.tpZones[1].type}]` : ''}`);
  }
  
  // Test 7: Candle strength analysis
  console.log('\n✓ Test 7: Enhanced Candle Analysis');
  const currentCandle = candles[candles.length - 1];
  const strength = getCandleStrength(currentCandle);
  console.log(`  Direction: ${strength.direction}`);
  console.log(`  Body strength: ${(strength.strength * 100).toFixed(1)}%`);
  console.log(`  Close location: ${(strength.closeLocation * 100).toFixed(1)}%`);
  if (strength.rejection) {
    console.log(`  Rejection: ${strength.rejection.type} (${(strength.rejection.strength * 100).toFixed(1)}%)`);
  }
  
  // Test 8: Regime detection
  console.log('\n✓ Test 8: Market Regime Detection');
  const pivotHighs = detectPivotHighs(candles, 5);
  const pivotLows = detectPivotLows(candles, 5);
  const regime = detectMarketRegime(candles, pivotHighs, pivotLows, { atrPeriod: 14 });
  console.log(`  Regime: ${regime.regime}`);
  console.log(`  Confidence: ${(regime.confidence * 100).toFixed(1)}%`);
  console.log(`  ATR: ${regime.atr.toFixed(2)}`);
  
  // Test 9: Structure events
  console.log('\n✓ Test 9: Structure Events (BOS/CHoCH)');
  const currentTrend = analyzeMarketStructure(candles, 5);
  const structureEvent = detectStructureEvents(candles, pivotHighs, pivotLows, currentTrend, 3);
  if (structureEvent) {
    console.log(`  Event: ${structureEvent.type} (${structureEvent.direction})`);
    console.log(`  Level: ${structureEvent.level.toFixed(2)}`);
  } else {
    console.log(`  No structure event detected`);
  }
  
  // Test 10: Liquidity sweep
  console.log('\n✓ Test 10: Liquidity Sweep Detection');
  const sweep = detectRecentSweep(candles, pivotHighs, pivotLows, null, 5);
  if (sweep) {
    console.log(`  Sweep: ${sweep.direction} at ${sweep.level.toFixed(2)}`);
    console.log(`  Strength: ${(sweep.strength * 100).toFixed(1)}%`);
  } else {
    console.log(`  No liquidity sweep detected`);
  }
  
  console.log('\n═══════════════════════════════════════');
  console.log('✓ All integration tests passed!');
  console.log('═══════════════════════════════════════\n');
  
} catch (error) {
  console.error('\n❌ Integration test failed:');
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}
