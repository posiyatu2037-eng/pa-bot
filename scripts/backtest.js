#!/usr/bin/env node

/**
 * Backtest Script for PA-Bot Signal Engine
 * 
 * Usage:
 *   node scripts/backtest.js --symbol BTCUSDT --timeframe 1h --period 30d
 *   node scripts/backtest.js --symbols BTCUSDT,ETHUSDT --timeframe 1h --period 7d
 *   node scripts/backtest.js --config  (uses .env settings)
 * 
 * Options:
 *   --symbol <SYMBOL>        Single symbol to backtest
 *   --symbols <SYMBOLS>      Comma-separated list of symbols
 *   --timeframe <TF>         Timeframe to test (e.g., 1h, 4h)
 *   --period <PERIOD>        Period to backtest (e.g., 7d, 30d, 90d)
 *   --start <DATE>           Start date (YYYY-MM-DD)
 *   --end <DATE>             End date (YYYY-MM-DD)
 *   --config                 Use symbols/timeframes from .env
 *   --output <FILE>          Save report to file (default: console)
 *   --min-score <N>          Minimum signal score threshold
 *   --detailed               Show detailed signal logs
 */

require('dotenv').config();
const { fetchKlines } = require('../src/binance/rest');
const klinesCache = require('../src/binance/klinesCache');
const SignalEngine = require('../src/app/engine');
const { validateSymbols } = require('../src/binance/exchangeInfo');
const fs = require('fs');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    symbols: [],
    timeframe: '1h',
    period: '30d',
    startDate: null,
    endDate: null,
    useConfig: false,
    output: null,
    minScore: null,
    detailed: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--symbol' && args[i + 1]) {
      options.symbols = [args[i + 1]];
      i++;
    } else if (arg === '--symbols' && args[i + 1]) {
      options.symbols = args[i + 1].split(',').map(s => s.trim());
      i++;
    } else if (arg === '--timeframe' && args[i + 1]) {
      options.timeframe = args[i + 1];
      i++;
    } else if (arg === '--period' && args[i + 1]) {
      options.period = args[i + 1];
      i++;
    } else if (arg === '--start' && args[i + 1]) {
      options.startDate = args[i + 1];
      i++;
    } else if (arg === '--end' && args[i + 1]) {
      options.endDate = args[i + 1];
      i++;
    } else if (arg === '--config') {
      options.useConfig = true;
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++;
    } else if (arg === '--min-score' && args[i + 1]) {
      options.minScore = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--detailed') {
      options.detailed = true;
    }
  }

  return options;
}

/**
 * Parse period string to days
 */
function parsePeriodToDays(period) {
  const match = period.match(/^(\d+)([dwmy])$/);
  if (!match) {
    throw new Error(`Invalid period format: ${period}. Use format like 7d, 30d, 3m`);
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'd': return value;
    case 'w': return value * 7;
    case 'm': return value * 30;
    case 'y': return value * 365;
    default: return 30;
  }
}

/**
 * Calculate date range
 */
function calculateDateRange(options) {
  let endDate = options.endDate ? new Date(options.endDate) : new Date();
  let startDate;
  
  if (options.startDate) {
    startDate = new Date(options.startDate);
  } else {
    const days = parsePeriodToDays(options.period);
    startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  }
  
  return { startDate, endDate };
}

/**
 * Fetch historical data for backtesting
 */
async function fetchHistoricalData(symbol, timeframe, startDate, endDate) {
  console.log(`[Backtest] Fetching ${symbol} ${timeframe} from ${startDate.toISOString()} to ${endDate.toISOString()}...`);
  
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  
  // Fetch with limit (max 1500 candles per request)
  const limit = 1500;
  const klines = await fetchKlines(symbol, timeframe, limit, startTime, endTime);
  
  console.log(`[Backtest] Fetched ${klines.length} candles`);
  return klines;
}

/**
 * Simulate signals on historical data
 */
async function simulateSignals(symbol, timeframe, candles, engine, options) {
  const signals = [];
  const minCandles = 100; // Minimum candles needed for analysis
  
  console.log(`[Backtest] Simulating signals for ${symbol} ${timeframe}...`);
  
  // Initialize cache with first batch of candles
  klinesCache.init(symbol, timeframe, candles.slice(0, minCandles));
  
  // Simulate each candle close
  for (let i = minCandles; i < candles.length; i++) {
    const candle = candles[i];
    
    // Update cache with new candle
    klinesCache.updateCandle(symbol, timeframe, candle);
    
    // Try to generate ENTRY signal
    const signal = await engine.analyzeForEntry(symbol, timeframe, false);
    
    if (signal) {
      signals.push(signal);
      
      if (options.detailed) {
        console.log(`[Signal] ${symbol} ${timeframe} ${signal.side} @ ${signal.levels.entry} | Score: ${signal.score}`);
      }
    }
  }
  
  console.log(`[Backtest] Generated ${signals.length} signals for ${symbol} ${timeframe}`);
  return signals;
}

/**
 * Calculate win rate and performance metrics
 * Simplified: assumes TP1 hit = win, SL hit = loss
 */
function calculateMetrics(signals, candles, symbol, timeframe) {
  let wins = 0;
  let losses = 0;
  let totalRR = 0;
  let totalPnL = 0;
  
  for (const signal of signals) {
    // Find candles after signal timestamp
    const signalIndex = candles.findIndex(c => c.closeTime >= signal.timestamp);
    if (signalIndex === -1 || signalIndex >= candles.length - 1) continue;
    
    const futureCandles = candles.slice(signalIndex + 1);
    
    let hitSL = false;
    let hitTP1 = false;
    let hitTP2 = false;
    
    const entry = signal.levels.entry;
    const sl = signal.levels.stopLoss;
    const tp1 = signal.levels.takeProfit1;
    const tp2 = signal.levels.takeProfit2;
    
    // Check each future candle for SL or TP hit
    for (const candle of futureCandles) {
      if (signal.side === 'LONG') {
        if (candle.low <= sl) {
          hitSL = true;
          break;
        }
        if (candle.high >= tp1) {
          hitTP1 = true;
          // Check for TP2
          if (tp2 && candle.high >= tp2) {
            hitTP2 = true;
          }
          break;
        }
      } else { // SHORT
        if (candle.high >= sl) {
          hitSL = true;
          break;
        }
        if (candle.low <= tp1) {
          hitTP1 = true;
          // Check for TP2
          if (tp2 && candle.low <= tp2) {
            hitTP2 = true;
          }
          break;
        }
      }
    }
    
    // Calculate result
    if (hitSL) {
      losses++;
      const risk = Math.abs(entry - sl);
      totalPnL -= risk;
    } else if (hitTP2) {
      wins++;
      const reward = Math.abs(tp2 - entry);
      totalPnL += reward;
      const risk = Math.abs(entry - sl);
      const rr2 = reward / risk;
      totalRR += rr2;
    } else if (hitTP1) {
      wins++;
      const reward = Math.abs(tp1 - entry);
      totalPnL += reward;
      totalRR += signal.levels.riskReward1;
    }
    // If neither hit within available data, we don't count it
  }
  
  const totalTrades = wins + losses;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const avgRR = totalTrades > 0 ? totalRR / totalTrades : 0;
  const expectancy = totalTrades > 0 ? totalPnL / totalTrades : 0;
  
  return {
    symbol,
    timeframe,
    totalSignals: signals.length,
    trades: totalTrades,
    wins,
    losses,
    winRate,
    avgRR,
    expectancy,
    totalPnL
  };
}

/**
 * Generate report
 */
function generateReport(results, options) {
  let report = '\n';
  report += '='.repeat(80) + '\n';
  report += 'PA-BOT BACKTEST REPORT\n';
  report += '='.repeat(80) + '\n\n';
  
  report += `Period: ${options.startDate || 'Auto'} to ${options.endDate || 'Now'}\n`;
  report += `Timeframe: ${options.timeframe}\n`;
  if (options.minScore) {
    report += `Min Score: ${options.minScore}\n`;
  }
  report += '\n';
  
  // Per-symbol results
  for (const result of results) {
    report += '-'.repeat(80) + '\n';
    report += `Symbol: ${result.symbol} | Timeframe: ${result.timeframe}\n`;
    report += '-'.repeat(80) + '\n';
    report += `Total Signals: ${result.totalSignals}\n`;
    report += `Trades: ${result.trades} (${result.wins}W / ${result.losses}L)\n`;
    report += `Win Rate: ${result.winRate.toFixed(2)}%\n`;
    report += `Avg R:R: ${result.avgRR.toFixed(2)}\n`;
    report += `Expectancy: ${result.expectancy.toFixed(4)}\n`;
    report += `Total P&L: ${result.totalPnL.toFixed(4)}\n`;
    report += '\n';
  }
  
  // Overall summary
  if (results.length > 1) {
    const totalSignals = results.reduce((sum, r) => sum + r.totalSignals, 0);
    const totalTrades = results.reduce((sum, r) => sum + r.trades, 0);
    const totalWins = results.reduce((sum, r) => sum + r.wins, 0);
    const totalLosses = results.reduce((sum, r) => sum + r.losses, 0);
    const avgWinRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.length;
    const avgRR = results.reduce((sum, r) => sum + r.avgRR, 0) / results.length;
    const totalPnL = results.reduce((sum, r) => sum + r.totalPnL, 0);
    
    report += '='.repeat(80) + '\n';
    report += 'OVERALL SUMMARY\n';
    report += '='.repeat(80) + '\n';
    report += `Total Signals: ${totalSignals}\n`;
    report += `Total Trades: ${totalTrades} (${totalWins}W / ${totalLosses}L)\n`;
    report += `Avg Win Rate: ${avgWinRate.toFixed(2)}%\n`;
    report += `Avg R:R: ${avgRR.toFixed(2)}\n`;
    report += `Total P&L: ${totalPnL.toFixed(4)}\n`;
    report += '\n';
  }
  
  report += '='.repeat(80) + '\n';
  
  return report;
}

/**
 * Main backtest function
 */
async function runBacktest() {
  console.log('PA-Bot Backtest Script\n');
  
  const options = parseArgs();
  
  // Determine symbols to test
  if (options.useConfig) {
    const symbolsEnv = process.env.SYMBOLS || 'BTCUSDT,ETHUSDT';
    options.symbols = symbolsEnv.split(',').map(s => s.trim());
    
    const entryTF = process.env.ENTRY_TIMEFRAMES || '1h';
    options.timeframe = entryTF.split(',')[0].trim(); // Use first entry timeframe
  }
  
  if (options.symbols.length === 0) {
    console.error('Error: No symbols specified. Use --symbol, --symbols, or --config');
    process.exit(1);
  }
  
  // Validate symbols
  console.log('[Backtest] Validating symbols...');
  const validSymbols = await validateSymbols(options.symbols);
  
  if (validSymbols.length === 0) {
    console.error('Error: No valid symbols to backtest');
    process.exit(1);
  }
  
  console.log(`[Backtest] Valid symbols: ${validSymbols.join(', ')}`);
  
  // Calculate date range
  const { startDate, endDate } = calculateDateRange(options);
  console.log(`[Backtest] Period: ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  // Create engine with custom config if needed
  const engineConfig = {};
  if (options.minScore) {
    engineConfig.entryScoreThreshold = options.minScore;
  }
  
  const engine = new SignalEngine(engineConfig);
  
  // Temporarily disable Telegram sending
  process.env.DRY_RUN = 'true';
  
  // Run backtest for each symbol
  const results = [];
  
  for (const symbol of validSymbols) {
    try {
      // Fetch historical data
      const candles = await fetchHistoricalData(
        symbol,
        options.timeframe,
        startDate,
        endDate
      );
      
      if (candles.length < 100) {
        console.log(`[Backtest] Insufficient data for ${symbol}, skipping`);
        continue;
      }
      
      // Simulate signals
      const signals = await simulateSignals(
        symbol,
        options.timeframe,
        candles,
        engine,
        options
      );
      
      // Calculate metrics
      const metrics = calculateMetrics(signals, candles, symbol, options.timeframe);
      results.push(metrics);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (err) {
      console.error(`[Backtest] Error processing ${symbol}:`, err.message);
    }
  }
  
  // Generate report
  const report = generateReport(results, options);
  
  // Output report
  if (options.output) {
    fs.writeFileSync(options.output, report);
    console.log(`\n[Backtest] Report saved to ${options.output}`);
  } else {
    console.log(report);
  }
  
  console.log('[Backtest] Complete!');
}

// Run if called directly
if (require.main === module) {
  runBacktest().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { runBacktest };
