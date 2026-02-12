#!/usr/bin/env node

/**
 * Preview Telegram Message Script
 * Generate and print a sample formatted message using dummy signal object
 */

require('dotenv').config();

const { formatSignalMessage } = require('../src/notify/format');

// Create a dummy signal object with all possible fields
const dummySignal = {
  symbol: 'BTCUSDT',
  timeframe: '4h',
  side: 'LONG',
  score: 82,
  timestamp: Date.now(),
  
  levels: {
    entry: 42500.50,
    stopLoss: 42000.00,
    takeProfit1: 43500.00,
    takeProfit2: 44500.00,
    riskReward1: 2.0,
    riskReward2: 4.0,
    winRate: 65,
    expectedValue: 1.3,
    tpZones: [
      { center: 43500.00, type: 'resistance' },
      { center: 44500.00, type: 'resistance' },
      { center: 45500.00, type: 'resistance' }
    ],
    slZone: { type: 'support' }
  },
  
  setup: {
    type: 'reversal',
    pattern: {
      name: 'Hammer',
      type: 'bullish',
      strength: 0.85
    },
    zone: {
      type: 'support'
    }
  },
  
  htfBias: {
    bias: 'bullish',
    alignment: true,
    structures: {
      '1d': 'up',
      '4h': 'up'
    }
  },
  
  divergence: {
    bullish: true
  },
  
  volumeRatio: 2.3
};

console.log('='.repeat(70));
console.log('TELEGRAM MESSAGE PREVIEW');
console.log('='.repeat(70));
console.log();
console.log('Signal Configuration:');
console.log(`- Symbol: ${dummySignal.symbol}`);
console.log(`- Timeframe: ${dummySignal.timeframe}`);
console.log(`- Side: ${dummySignal.side}`);
console.log(`- Score: ${dummySignal.score}`);
console.log(`- Source Text: ${process.env.SIGNAL_SOURCE_TEXT || 'Posiya Tú zalo 0763888872'}`);
console.log();
console.log('='.repeat(70));
console.log('FORMATTED MESSAGE (HTML):');
console.log('='.repeat(70));
console.log();

const message = formatSignalMessage(dummySignal);
console.log(message);

console.log();
console.log('='.repeat(70));
console.log('MESSAGE LENGTH:', message.length, 'characters');
console.log('='.repeat(70));
console.log();
console.log('Note: This message uses HTML formatting. Telegram will render:');
console.log('  - <b>text</b> as bold');
console.log('  - <code>text</code> as monospace');
console.log('  - Emojis and special characters as-is');
console.log();

// Also test a SHORT signal
console.log('='.repeat(70));
console.log('SHORT SIGNAL PREVIEW (with minimal data):');
console.log('='.repeat(70));
console.log();

const dummyShortSignal = {
  symbol: 'ETHUSDT',
  timeframe: '1h',
  side: 'SHORT',
  score: 75,
  timestamp: Date.now(),
  
  levels: {
    entry: 2500.00,
    stopLoss: 2550.00,
    takeProfit1: 2400.00,
    riskReward1: 2.0
  },
  
  setup: {
    type: 'breakout'
  },
  
  htfBias: {
    bias: 'bearish',
    alignment: false,
    structures: {
      '1d': 'down',
      '4h': 'up'
    }
  },
  
  volumeRatio: 1.6
};

const shortMessage = formatSignalMessage(dummyShortSignal);
console.log(shortMessage);
console.log();
console.log('='.repeat(70));
