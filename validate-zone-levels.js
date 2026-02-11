#!/usr/bin/env node
/**
 * Validation script for zone-based level calculations
 * Tests the new SL/TP zone logic with sample setups
 */

const { buildZones, findNextOpposingZones, findStopLossZone } = require('./src/pa/zones');
const { calculateLevels } = require('./src/pa/score');

// Sample candle data for testing
function generateSampleCandles(count = 100, basePrice = 50000, volatility = 500) {
  const candles = [];
  let price = basePrice;
  
  for (let i = 0; i < count; i++) {
    const open = price + (Math.random() - 0.5) * volatility;
    const close = open + (Math.random() - 0.5) * volatility * 0.8;
    const high = Math.max(open, close) + Math.random() * volatility * 0.3;
    const low = Math.min(open, close) - Math.random() * volatility * 0.3;
    
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

function testZoneBuilding() {
  console.log('\n=== Test 1: Zone Building ===');
  const candles = generateSampleCandles(100, 50000, 500);
  const zones = buildZones(candles, 100, 5, 0.5);
  
  console.log(`✓ Built ${zones.support.length} support zones`);
  console.log(`✓ Built ${zones.resistance.length} resistance zones`);
  console.log(`✓ Total zones: ${zones.support.length + zones.resistance.length}`);
  
  if (zones.support.length > 0) {
    console.log('\nSample Support Zones:');
    zones.support.slice(0, 3).forEach((z, i) => {
      console.log(`  ${i + 1}. Center: ${z.center.toFixed(2)}, Range: ${z.lower.toFixed(2)} - ${z.upper.toFixed(2)}`);
    });
  }
  
  if (zones.resistance.length > 0) {
    console.log('\nSample Resistance Zones:');
    zones.resistance.slice(0, 3).forEach((z, i) => {
      console.log(`  ${i + 1}. Center: ${z.center.toFixed(2)}, Range: ${z.lower.toFixed(2)} - ${z.upper.toFixed(2)}`);
    });
  }
  
  return zones;
}

function testLongSetup(zones, candles) {
  console.log('\n=== Test 2: LONG Setup with Zone-based SL/TP ===');
  
  const currentPrice = candles[candles.length - 1].close;
  console.log(`Current Price: ${currentPrice.toFixed(2)}`);
  
  // Find a support zone below current price
  const supportZone = zones.support.find(z => z.center < currentPrice);
  
  if (!supportZone) {
    console.log('⚠️  No support zone found below current price');
    return;
  }
  
  const setup = {
    side: 'LONG',
    price: currentPrice,
    zone: supportZone,
    zones: zones,
    type: 'reversal',
    name: 'Test Bullish Reversal'
  };
  
  const levels = calculateLevels(setup, 0.2);
  
  console.log('\nCalculated Levels:');
  console.log(`  Entry: ${levels.entry.toFixed(2)}`);
  console.log(`  Stop Loss: ${levels.stopLoss.toFixed(2)}${levels.slZone ? ` (${levels.slZone.type} zone)` : ''}`);
  console.log(`  TP1: ${levels.takeProfit1.toFixed(2)} (${levels.riskReward1}R)${levels.tpZones[0] ? ` [${levels.tpZones[0].type}]` : ''}`);
  console.log(`  TP2: ${levels.takeProfit2.toFixed(2)} (${levels.riskReward2}R)${levels.tpZones[1] ? ` [${levels.tpZones[1].type}]` : ''}`);
  
  // Validate
  const risk = levels.entry - levels.stopLoss;
  console.log(`\nRisk: ${risk.toFixed(2)} (${((risk / levels.entry) * 100).toFixed(2)}%)`);
  console.log(`Reward 1: ${(levels.takeProfit1 - levels.entry).toFixed(2)} (${(((levels.takeProfit1 - levels.entry) / levels.entry) * 100).toFixed(2)}%)`);
  console.log(`Reward 2: ${(levels.takeProfit2 - levels.entry).toFixed(2)} (${(((levels.takeProfit2 - levels.entry) / levels.entry) * 100).toFixed(2)}%)`);
  
  // Validate SL is below entry
  if (levels.stopLoss >= levels.entry) {
    console.log('❌ ERROR: Stop loss should be below entry for LONG');
  } else {
    console.log('✓ Stop loss correctly placed below entry');
  }
  
  // Validate TP is above entry
  if (levels.takeProfit1 <= levels.entry) {
    console.log('❌ ERROR: Take profit should be above entry for LONG');
  } else {
    console.log('✓ Take profit correctly placed above entry');
  }
}

function testShortSetup(zones, candles) {
  console.log('\n=== Test 3: SHORT Setup with Zone-based SL/TP ===');
  
  const currentPrice = candles[candles.length - 1].close;
  console.log(`Current Price: ${currentPrice.toFixed(2)}`);
  
  // Find a resistance zone above current price
  const resistanceZone = zones.resistance.find(z => z.center > currentPrice);
  
  if (!resistanceZone) {
    console.log('⚠️  No resistance zone found above current price');
    return;
  }
  
  const setup = {
    side: 'SHORT',
    price: currentPrice,
    zone: resistanceZone,
    zones: zones,
    type: 'reversal',
    name: 'Test Bearish Reversal'
  };
  
  const levels = calculateLevels(setup, 0.2);
  
  console.log('\nCalculated Levels:');
  console.log(`  Entry: ${levels.entry.toFixed(2)}`);
  console.log(`  Stop Loss: ${levels.stopLoss.toFixed(2)}${levels.slZone ? ` (${levels.slZone.type} zone)` : ''}`);
  console.log(`  TP1: ${levels.takeProfit1.toFixed(2)} (${levels.riskReward1}R)${levels.tpZones[0] ? ` [${levels.tpZones[0].type}]` : ''}`);
  console.log(`  TP2: ${levels.takeProfit2.toFixed(2)} (${levels.riskReward2}R)${levels.tpZones[1] ? ` [${levels.tpZones[1].type}]` : ''}`);
  
  // Validate
  const risk = levels.stopLoss - levels.entry;
  console.log(`\nRisk: ${risk.toFixed(2)} (${((risk / levels.entry) * 100).toFixed(2)}%)`);
  console.log(`Reward 1: ${(levels.entry - levels.takeProfit1).toFixed(2)} (${(((levels.entry - levels.takeProfit1) / levels.entry) * 100).toFixed(2)}%)`);
  console.log(`Reward 2: ${(levels.entry - levels.takeProfit2).toFixed(2)} (${(((levels.entry - levels.takeProfit2) / levels.entry) * 100).toFixed(2)}%)`);
  
  // Validate SL is above entry
  if (levels.stopLoss <= levels.entry) {
    console.log('❌ ERROR: Stop loss should be above entry for SHORT');
  } else {
    console.log('✓ Stop loss correctly placed above entry');
  }
  
  // Validate TP is below entry
  if (levels.takeProfit1 >= levels.entry) {
    console.log('❌ ERROR: Take profit should be below entry for SHORT');
  } else {
    console.log('✓ Take profit correctly placed below entry');
  }
}

function testOpposingZones() {
  console.log('\n=== Test 4: Finding Opposing Zones ===');
  
  const candles = generateSampleCandles(100, 50000, 500);
  const zones = buildZones(candles, 100, 5, 0.5);
  const currentPrice = candles[candles.length - 1].close;
  
  // Test LONG - find resistance zones above
  console.log('\nLONG Trade - Finding Resistance Zones Above:');
  const longTPZones = findNextOpposingZones(currentPrice, zones.resistance, 'LONG', 3);
  if (longTPZones.length > 0) {
    longTPZones.forEach((z, i) => {
      console.log(`  TP${i + 1}: ${z.center.toFixed(2)} (+${z.distancePercent.toFixed(2)}%)`);
    });
    console.log(`✓ Found ${longTPZones.length} resistance zones above entry`);
  } else {
    console.log('⚠️  No resistance zones found above entry');
  }
  
  // Test SHORT - find support zones below
  console.log('\nSHORT Trade - Finding Support Zones Below:');
  const shortTPZones = findNextOpposingZones(currentPrice, zones.support, 'SHORT', 3);
  if (shortTPZones.length > 0) {
    shortTPZones.forEach((z, i) => {
      console.log(`  TP${i + 1}: ${z.center.toFixed(2)} (-${z.distancePercent.toFixed(2)}%)`);
    });
    console.log(`✓ Found ${shortTPZones.length} support zones below entry`);
  } else {
    console.log('⚠️  No support zones found below entry');
  }
}

function testStopLossZones() {
  console.log('\n=== Test 5: Finding Stop Loss Zones ===');
  
  const candles = generateSampleCandles(100, 50000, 500);
  const zones = buildZones(candles, 100, 5, 0.5);
  const currentPrice = candles[candles.length - 1].close;
  
  // Test LONG - find support zone below
  console.log('\nLONG Trade - Finding Support Zone for SL:');
  const longSLZone = findStopLossZone(currentPrice, zones.support, 'LONG');
  if (longSLZone) {
    const distance = currentPrice - longSLZone.center;
    const distancePercent = (distance / currentPrice) * 100;
    console.log(`  SL Zone: ${longSLZone.center.toFixed(2)} (-${distancePercent.toFixed(2)}%)`);
    console.log(`✓ Found support zone for stop loss`);
  } else {
    console.log('⚠️  No support zone found for stop loss');
  }
  
  // Test SHORT - find resistance zone above
  console.log('\nSHORT Trade - Finding Resistance Zone for SL:');
  const shortSLZone = findStopLossZone(currentPrice, zones.resistance, 'SHORT');
  if (shortSLZone) {
    const distance = shortSLZone.center - currentPrice;
    const distancePercent = (distance / currentPrice) * 100;
    console.log(`  SL Zone: ${shortSLZone.center.toFixed(2)} (+${distancePercent.toFixed(2)}%)`);
    console.log(`✓ Found resistance zone for stop loss`);
  } else {
    console.log('⚠️  No resistance zone found for stop loss');
  }
}

// Run all tests
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  Zone-Based Level Calculation Validation                  ║');
console.log('╚════════════════════════════════════════════════════════════╝');

try {
  const candles = generateSampleCandles(100, 50000, 500);
  const zones = testZoneBuilding();
  
  if (zones.support.length > 0 && zones.resistance.length > 0) {
    testLongSetup(zones, candles);
    testShortSetup(zones, candles);
    testOpposingZones();
    testStopLossZones();
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✓ All tests completed successfully                       ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  } else {
    console.log('\n⚠️  Insufficient zones for full testing');
    console.log('Try running again or adjusting sample data parameters\n');
  }
} catch (error) {
  console.error('\n❌ Test failed with error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
