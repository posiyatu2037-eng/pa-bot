/**
 * Format trading signals for Telegram messages
 * Uses HTML for clean, professional formatting
 */

const { getRegimeDisplayName } = require('../pa/regime');

/**
 * Format a number for display
 */
function formatNumber(num, decimals = 2) {
  if (!isFinite(num)) return 'N/A';
  return num.toFixed(decimals);
}

/**
 * Pattern translation map for Vietnamese
 */
const PATTERN_TRANSLATIONS = {
  'Hammer': 'Búa',
  'Shooting Star': 'Sao Băng',
  'Bullish Engulfing': 'Nhấn Chìm Tăng',
  'Bearish Engulfing': 'Nhấn Chìm Giảm',
  'Doji': 'Doji',
  'Tweezer Top': 'Tweezer Đỉnh',
  'Tweezer Bottom': 'Tweezer Đáy',
  'Morning Star': 'Sao Mai',
  'Evening Star': 'Sao Hôm',
  'Inside Bar': 'Inside Bar',
  '2-Bar Reversal (Bullish)': 'Đảo Chiều 2 Nến (Tăng)',
  '2-Bar Reversal (Bearish)': 'Đảo Chiều 2 Nến (Giảm)'
};

/**
 * Translate pattern name to Vietnamese
 */
function translatePattern(patternName) {
  return PATTERN_TRANSLATIONS[patternName] || patternName;
}

/**
 * Generate reasons for entering trade in Vietnamese
 */
function generateTradeReasons(signal) {
  const { setup, htfBias, regime, structureEvent, sweep, divergence, volumeRatio } = signal;
  const reasons = [];

  // 1. Market Regime
  if (regime && regime.regime !== 'unknown') {
    const regimeVN = getRegimeDisplayName(regime.regime);
    const confidence = Math.round(regime.confidence * 100);
    reasons.push(`✅ Thị trường: ${regimeVN} (độ tin cậy ${confidence}%)`);
  }

  // 2. HTF Bias
  if (htfBias && htfBias.bias !== 'neutral') {
    const structures = htfBias.structures || {};
    const biasVN = htfBias.bias === 'bullish' ? 'TĂNG' : 'GIẢM';
    const d1 = structures['1d'] === 'up' ? 'tăng' : structures['1d'] === 'down' ? 'giảm' : 'ngang';
    const h4 = structures['4h'] === 'up' ? 'tăng' : structures['4h'] === 'down' ? 'giảm' : 'ngang';
    
    if (htfBias.alignment) {
      reasons.push(`✅ Xu hướng lớn ${biasVN} đồng bộ (1D ${d1}, 4H ${h4})`);
    } else {
      reasons.push(`✅ Xu hướng lớn ${biasVN} (1D ${d1}, 4H ${h4})`);
    }
  }

  // 3. Structure Event (BOS/CHoCH)
  if (structureEvent) {
    if (structureEvent.type === 'BOS') {
      const direction = structureEvent.direction === 'bullish' ? 'tăng' : 'giảm';
      reasons.push(`✅ BOS (Break of Structure) ${direction} - xác nhận xu hướng`);
    } else if (structureEvent.type === 'CHoCH') {
      const fromTo = structureEvent.direction === 'bullish' ? 'giảm → tăng' : 'tăng → giảm';
      reasons.push(`✅ CHoCH (Change of Character) ${fromTo} - đảo chiều`);
    }
  }

  // 4. Liquidity Sweep
  if (sweep && sweep.isCurrent) {
    if (sweep.direction === 'bullish') {
      reasons.push(`✅ Sweep thanh khoản dưới mức thấp - tín hiệu tăng`);
    } else {
      reasons.push(`✅ Sweep thanh khoản trên mức cao - tín hiệu giảm`);
    }
  }

  // 5. Pattern analysis
  if (setup.pattern) {
    const patternVN = translatePattern(setup.pattern.name || 'Unknown');
    const strength = Math.round((setup.pattern.strength || 0) * 100);
    reasons.push(`✅ Mô hình nến: ${patternVN} (${strength}%)`);
  }

  // 6. Setup type analysis
  const setupType = setup.type || '';
  if (setupType === 'reversal') {
    const zoneType = setup.zone?.type === 'support' ? 'hỗ trợ' : 'kháng cự';
    reasons.push(`✅ Đảo chiều tại vùng ${zoneType}`);
  } else if (setupType === 'breakout' || setupType === 'breakdown') {
    if (setup.isTrue) {
      reasons.push(`✅ Breakout thật có volume xác nhận`);
    } else {
      reasons.push(`✅ Breakout giả - cơ hội fade`);
    }
  } else if (setupType === 'retest') {
    reasons.push(`✅ Retest vùng đã vỡ`);
  } else if (setupType === 'false_breakout' || setupType === 'false_breakdown') {
    reasons.push(`✅ Bẫy breakout giả - wick dài`);
  }

  // 7. Volume analysis
  if (volumeRatio) {
    if (volumeRatio > 2.0) {
      reasons.push(`✅ Volume cực mạnh (${formatNumber(volumeRatio, 1)}x)`);
    } else if (volumeRatio > 1.5) {
      reasons.push(`✅ Volume tăng mạnh (${formatNumber(volumeRatio, 1)}x)`);
    }
  }

  // 8. RSI Divergence
  if (divergence && (divergence.bullish || divergence.bearish)) {
    const divType = divergence.bullish ? 'Phân kỳ tăng' : 'Phân kỳ giảm';
    reasons.push(`✅ ${divType} (RSI)`);
  }

  return reasons;
}

/**
 * Format signal as Telegram message in Vietnamese using HTML
 * @param {Object} signal - Complete signal object
 * @returns {string} Formatted HTML message
 */
function formatSignalMessage(signal) {
  const {
    symbol,
    timeframe,
    side,
    score,
    levels,
    timestamp
  } = signal;

  const sourceName = process.env.SOURCE_NAME || 'PA-Bot';
  
  // Build the message using HTML
  let message = '';

  // === HEADER ===
  const sideVN = side === 'LONG' ? 'MUA' : 'BÁN';
  const sideEmoji = side === 'LONG' ? '🟢' : '🔴';
  message += `${sideEmoji} <b>TÍN HIỆU ${sideVN}</b>\n`;
  message += `<b>${symbol}</b> | ${timeframe}\n\n`;

  // === TRADE PLAN ===
  message += `<b>📋 KẾ HOẠCH GIAO DỊCH</b>\n`;
  message += `<code>`;
  message += `Entry:  ${formatNumber(levels.entry, 8)}\n`;
  
  // SL with distance
  const slDistance = levels.entry > 0 
    ? Math.abs((levels.stopLoss - levels.entry) / levels.entry * 100)
    : 0;
  message += `SL:     ${formatNumber(levels.stopLoss, 8)} (-${formatNumber(slDistance, 2)}%)\n`;
  
  // TP levels
  message += `TP1:    ${formatNumber(levels.takeProfit1, 8)} (${formatNumber(levels.riskReward1, 1)}R)\n`;
  
  if (levels.takeProfit2) {
    message += `TP2:    ${formatNumber(levels.takeProfit2, 8)} (${formatNumber(levels.riskReward2, 1)}R)\n`;
  }
  
  // TP3 if available from tpZones
  if (levels.tpZones && levels.tpZones[2]) {
    const tp3 = levels.tpZones[2].center;
    const tp3Distance = Math.abs(tp3 - levels.entry);
    const risk = Math.abs(levels.entry - levels.stopLoss);
    
    if (risk > 0 && isFinite(tp3)) {
      const tp3RR = tp3Distance / risk;
      message += `TP3:    ${formatNumber(tp3, 8)} (${formatNumber(tp3RR, 1)}R)\n`;
    }
  }
  
  message += `</code>\n`;

  // === CONFIDENCE/SCORE ===
  const scoreIcon = score >= 85 ? '🟢' : score >= 70 ? '🟡' : score >= 60 ? '🟠' : '🔴';
  message += `${scoreIcon} <b>Điểm số:</b> ${score}/100\n\n`;

  // === REASONS ===
  message += `<b>💡 Lý do vào kèo</b>\n`;
  const reasons = generateTradeReasons(signal);
  for (const reason of reasons) {
    message += `${reason}\n`;
  }
  message += `\n`;

  // === TIMESTAMP AND FOOTER ===
  const date = new Date(timestamp);
  const timezone = process.env.TELEGRAM_TIMEZONE || 'Asia/Ho_Chi_Minh';
  const timeStr = date.toLocaleString('vi-VN', { 
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
  message += `🕐 ${timeStr}\n`;
  message += `<i>${sourceName}</i>`;

  return message;
}

/**
 * Format a simple text message for console/logging
 */
function formatSimpleMessage(signal) {
  return `[SIGNAL] ${signal.symbol} ${signal.timeframe} ${signal.side} @ ${signal.levels.entry} | Score: ${signal.score}`;
}

module.exports = {
  formatSignalMessage,
  formatSimpleMessage,
  generateTradeReasons,
  formatNumber
};

