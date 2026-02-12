/**
 * Format trading signals for Telegram messages
 * Uses HTML formatting
 */

/**
 * Escape HTML special characters for Telegram
 */
function escapeHtml(text) {
  if (typeof text !== 'string') {
    text = String(text);
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Format a number for display
 */
function formatNumber(num, decimals = 2) {
  if (typeof num !== 'number') return '--';
  return num.toFixed(decimals);
}

/**
 * Calculate percentage change
 */
function calculatePercent(from, to) {
  if (!from || !to) return null;
  return ((to - from) / from * 100);
}

/**
 * Pattern translation map for Vietnamese
 */
const PATTERN_TRANSLATIONS = {
  'Hammer': 'Búa (Hammer)',
  'Shooting Star': 'Sao Băng',
  'Bullish Engulfing': 'Nhấn Chìm Tăng',
  'Bearish Engulfing': 'Nhấn Chìm Giảm',
  'Doji': 'Doji'
};

/**
 * Translate pattern name to Vietnamese
 */
function translatePattern(patternName, patternType) {
  if (!patternName) return 'Không xác định';
  
  // Check exact match first
  if (PATTERN_TRANSLATIONS[patternName]) {
    return PATTERN_TRANSLATIONS[patternName];
  }
  
  // Check partial matches
  if (patternName.includes('Hammer')) return PATTERN_TRANSLATIONS['Hammer'];
  if (patternName.includes('Shooting Star')) return PATTERN_TRANSLATIONS['Shooting Star'];
  if (patternName.includes('Engulfing')) {
    return patternType === 'bullish' 
      ? PATTERN_TRANSLATIONS['Bullish Engulfing'] 
      : PATTERN_TRANSLATIONS['Bearish Engulfing'];
  }
  if (patternName.includes('Doji')) return PATTERN_TRANSLATIONS['Doji'];
  
  // Return original if no translation found
  return patternName;
}

/**
 * Get setup name in Vietnamese
 */
function getSetupNameVN(setup) {
  if (!setup || !setup.type) return 'Không xác định';
  
  const setupType = setup.type.toLowerCase();
  
  if (setupType === 'reversal') return 'Đảo chiều';
  if (setupType === 'breakout') return 'Vượt vùng';
  if (setupType === 'breakdown') return 'Vượt vùng xuống';
  if (setupType === 'retest') return 'Test lại';
  if (setupType === 'false_breakout' || setupType === 'false_breakdown') return 'Bẫy BO';
  
  return setup.type;
}

/**
 * Generate reasons for entering trade in Vietnamese
 */
function generateTradeReasons(signal, setup, htfBias, divergence, volumeRatio) {
  const reasons = [];
  
  // HTF Bias analysis
  if (htfBias && htfBias.bias !== 'neutral') {
    const structures = htfBias.structures || {};
    const biasVN = htfBias.bias === 'bullish' ? 'TĂNG' : 'GIẢM';
    const d1 = structures['1d'] === 'up' ? 'tăng' : structures['1d'] === 'down' ? 'giảm' : 'ngang';
    const h4 = structures['4h'] === 'up' ? 'tăng' : structures['4h'] === 'down' ? 'giảm' : 'ngang';
    
    if (htfBias.alignment) {
      reasons.push(`Xu hướng lớn ${biasVN} rõ ràng (1D ${d1}, 4H ${h4})`);
    } else {
      reasons.push(`Xu hướng lớn ${biasVN} nhưng chưa đồng bộ hoàn toàn`);
    }
  }
  
  // Pattern analysis
  if (setup && setup.pattern) {
    const patternVN = translatePattern(setup.pattern.name || 'Unknown', setup.pattern.type);
    const strength = Math.round((setup.pattern.strength || 0) * 100);
    reasons.push(`Mô hình nến ${patternVN} (độ mạnh ${strength}%)`);
  }
  
  // Setup type analysis
  const setupType = setup ? setup.type : '';
  if (setupType === 'reversal') {
    const zoneType = setup.zone?.type === 'support' ? 'hỗ trợ' : 'kháng cự';
    reasons.push(`Đảo chiều tại vùng ${zoneType} mạnh`);
  } else if (setupType === 'breakout' || setupType === 'breakdown') {
    if (setup.isTrue) {
      reasons.push(`Breakout THẬT - có volume xác nhận mạnh`);
    } else {
      reasons.push(`Breakout GIẢ - volume yếu, có thể trap`);
    }
  } else if (setupType === 'retest') {
    reasons.push(`Retest vùng đã vỡ - cơ hội vào lệnh tốt`);
  } else if (setupType === 'false_breakout' || setupType === 'false_breakdown') {
    reasons.push(`Bẫy breakout giả - wick dài nhưng close lại trong vùng`);
  }
  
  // Volume analysis
  if (volumeRatio) {
    if (volumeRatio > 2.0) {
      reasons.push(`Volume CỰC MẠNH (${formatNumber(volumeRatio, 1)}x TB) - tín hiệu rất tích cực`);
    } else if (volumeRatio > 1.5) {
      reasons.push(`Volume tăng mạnh (${formatNumber(volumeRatio, 1)}x TB) - xác nhận tốt`);
    } else if (volumeRatio < 0.8) {
      reasons.push(`Volume yếu (${formatNumber(volumeRatio, 1)}x TB) - cần thận trọng`);
    }
  }
  
  // RSI Divergence
  if (divergence && (divergence.bullish || divergence.bearish)) {
    const divType = divergence.bullish ? 'Phân kỳ tăng' : 'Phân kỳ giảm';
    reasons.push(`${divType} - tín hiệu đảo chiều mạnh`);
  }
  
  return reasons;
}

/**

 * Format signal as Telegram message in Vietnamese
 * Supports both SETUP (early warning) and ENTRY (confirmed) stages
 * Format signal as Telegram message in Vietnamese with HTML
 * @param {Object} signal - Complete signal object
 * @returns {string} Formatted HTML message
 */
function formatSignalMessage(signal) {
  const {
    stage,
    symbol,
    timeframe,
    side,
    score,
    levels,
    setup,
    htfBias,
    divergence,
    volumeRatio,
    chaseEval,
    timestamp
  } = signal;

  const sourceName = process.env.SOURCE_NAME || 'PA-Bot';
  const isSetup = stage === 'SETUP';
  const isEntry = stage === 'ENTRY';
  const sourceText = process.env.SIGNAL_SOURCE_TEXT || 'Posiya Tú zalo 0763888872';
  
  // Build the message with HTML
  let message = '';

  // Header with side and stage
  const sideVN = side === 'LONG' ? '🟢 MUA' : '🔴 BÁN';
  const sideEmoji = side === 'LONG' ? '📈' : '📉';
  
  if (isSetup) {
    message += `⚠️ *SETUP \\- CẢNH BÁO SỚM* ⚠️\n`;
    message += `${sideEmoji} *Hướng: ${sideVN}* ${sideEmoji}\n`;
  } else {
    message += `${sideEmoji} *TÍN HIỆU ${sideVN}* ${sideEmoji}\n`;
  }
  
  message += `*${escapeMarkdown(symbol)}* \\| ${escapeMarkdown(timeframe)}\n\n`;

  // For SETUP: Show warning and setup description
  if (isSetup) {
    message += `*━━━ SETUP ĐANG HÌNH THÀNH ━━━*\n`;
    message += `⏳ Setup: *${escapeMarkdown(setup.name)}*\n`;
    message += `📊 Điểm: *${score}/100*\n`;
    
    if (levels) {
      message += `💡 Entry dự kiến: ~${formatNumber(levels.entry, 8)}\n`;
      message += `🛑 SL dự kiến: ~${formatNumber(levels.stopLoss, 8)}\n`;
      message += `🎯 TP1 dự kiến: ~${formatNumber(levels.takeProfit1, 8)}\n`;
    }
    message += '\n';
    message += `⚠️ *Chờ xác nhận trước khi vào lệnh\\!*\n\n`;
  }

  // For ENTRY: Show full trade plan
  if (isEntry && levels) {
    message += `*━━━ KẾ HOẠCH GIAO DỊCH ━━━*\n`;
    message += '```\n';
    message += `Entry:  ${formatNumber(levels.entry, 8)}\n`;
    message += `SL:     ${formatNumber(levels.stopLoss, 8)}`;
    if (levels.slZone) {
      const slZoneVN = levels.slZone.type === 'support' ? 'hỗ trợ' : 'kháng cự';
      message += ` [${slZoneVN}]`;
    }
    message += '\n';
    
    // TP1
    message += `TP1:    ${formatNumber(levels.takeProfit1, 8)} (${formatNumber(levels.riskReward1, 1)}R)`;
    if (levels.tpZones && levels.tpZones[0]) {
      const tp1ZoneVN = levels.tpZones[0].type === 'resistance' ? 'kháng cự' : 'hỗ trợ';
      message += ` [${tp1ZoneVN}]`;
  // === HEADER ===
  const sideVN = side === 'LONG' ? 'LONG' : 'SHORT';
  const sideEmoji = side === 'LONG' ? '🟢' : '🔴';
  const setupName = getSetupNameVN(setup);
  
  message += `${sideEmoji} <b>${sideVN} | ${escapeHtml(symbol)} | ${escapeHtml(timeframe.toUpperCase())}</b>\n`;
  message += `<b>${escapeHtml(setupName)}</b>\n`;
  message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  // === TRADE PLAN ===
  message += `<b>📋 KẾ HOẠCH GIAO DỊCH</b>\n`;
  
  // Entry with percentage
  const entry = levels.entry;
  message += `Entry: <code>${formatNumber(entry, 8)}</code>\n`;
  
  // SL with percentage
  const sl = levels.stopLoss;
  const slPercent = calculatePercent(entry, sl);
  message += `SL: <code>${formatNumber(sl, 8)}</code>`;
  if (slPercent) {
    message += ` (${formatNumber(Math.abs(slPercent), 2)}%)`;
  }
  message += `\n`;
  
  // TP1 with RR and percentage
  const tp1 = levels.takeProfit1;
  const tp1Percent = calculatePercent(entry, tp1);
  const rr1 = levels.riskReward1;
  message += `TP1: <code>${formatNumber(tp1, 8)}</code>`;
  if (tp1Percent) {
    message += ` (${formatNumber(Math.abs(tp1Percent), 2)}%)`;
  }
  if (rr1) {
    message += ` [${formatNumber(rr1, 1)}R]`;
  }
  message += `\n`;
  
  // TP2 (if available)
  if (levels.takeProfit2) {
    const tp2 = levels.takeProfit2;
    const tp2Percent = calculatePercent(entry, tp2);
    const rr2 = levels.riskReward2;
    message += `TP2: <code>${formatNumber(tp2, 8)}</code>`;
    if (tp2Percent) {
      message += ` (${formatNumber(Math.abs(tp2Percent), 2)}%)`;
    }
    if (rr2) {
      message += ` [${formatNumber(rr2, 1)}R]`;
    }
    message += `\n`;
  }
  
  // TP3 (if available from tpZones)
  if (levels.tpZones && levels.tpZones[2]) {
    const tp3 = levels.tpZones[2].center;
    const tp3Percent = calculatePercent(entry, tp3);
    const risk = Math.abs(entry - sl);
    
    if (risk > 0) {
      const tp3Distance = Math.abs(tp3 - entry);
      const tp3RR = tp3Distance / risk;
      message += `TP3: <code>${formatNumber(tp3, 8)}</code>`;
      if (tp3Percent) {
        message += ` (${formatNumber(Math.abs(tp3Percent), 2)}%)`;
      }
      message += ` [${formatNumber(tp3RR, 1)}R]`;
      message += `\n`;
    }
    message += '\n';
    
    // TP2 (if available)
    if (levels.takeProfit2) {
      message += `TP2:    ${formatNumber(levels.takeProfit2, 8)} (${formatNumber(levels.riskReward2, 1)}R)`;
      if (levels.tpZones && levels.tpZones[1]) {
        const tp2ZoneVN = levels.tpZones[1].type === 'resistance' ? 'kháng cự' : 'hỗ trợ';
        message += ` [${tp2ZoneVN}]`;
      }
      message += '\n';
    }
    
    // Add TP3 if available from tpZones
    if (levels.tpZones && levels.tpZones[2]) {
      const tp3 = levels.tpZones[2].center;
      const tp3Distance = Math.abs(tp3 - levels.entry);
      const risk = Math.abs(levels.entry - levels.stopLoss);
      
      // Validate risk is not zero to avoid division by zero
      if (risk > 0) {
        const tp3RR = tp3Distance / risk;
        const tp3ZoneVN = levels.tpZones[2].type === 'resistance' ? 'kháng cự' : 'hỗ trợ';
        message += `TP3:    ${formatNumber(tp3, 8)} (${formatNumber(tp3RR, 1)}R) [${tp3ZoneVN}]\n`;
      }
    }
    
    message += '```\n\n';
  }

  message += `\n`;

  // === RR/WR/EV LINE ===
  const mainRR = levels.riskReward1 || '--';
  const wr = levels.winRate ? `${formatNumber(levels.winRate, 0)}%` : '--';
  const ev = levels.expectedValue ? formatNumber(levels.expectedValue, 2) : '--';
  
  message += `<b>Risk/Reward:</b> ${mainRR}R | <b>WR:</b> ${wr} | <b>EV:</b> ${ev}\n\n`;
      
  // Anti-chase info for ENTRY signals
  if (isEntry && chaseEval) {
    if (chaseEval.decision === 'CHASE_OK') {
      message += `✅ *Anti\\-Chase:* ${escapeMarkdown(chaseEval.reason)}\n\n`;
    } else if (chaseEval.decision === 'REVERSAL_WATCH') {
      message += `🔄 *Anti\\-Chase:* ${escapeMarkdown(chaseEval.reason)}\n\n`;
    }
  }

  // === TẠI SAO VÀO KÈO ===
  message += `*━━━ TẠI SAO VÀO KÈO ━━━*\n`;
  // === TRAILING NOTE (if score is displayed separately) ===
  message += `<b>Điểm tín hiệu:</b> ${score}/100\n\n`;

  // === REASONS SECTION ===
  message += `<b>💡 Lý do vào kèo</b>\n`;
      
  const reasons = generateTradeReasons(signal, setup, htfBias, divergence, volumeRatio);
  
  if (reasons.length > 0) {
    for (const reason of reasons) {
      message += `✅ ${escapeHtml(reason)}\n`;
    }
  } else {
    message += `✅ Phân tích Price Action tổng hợp\n`;
  }
  message += `\n`;

  // === FOOTER ===
  const date = new Date(timestamp);
  const timezone = process.env.TELEGRAM_TIMEZONE || 'Asia/Ho_Chi_Minh';
  
  // Format: HH:mm DD/MM/YYYY
  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false
  });
  message += `🕐 ${escapeMarkdown(timeStr)}\n`;
  
  // Add stage indicator to footer
  if (isSetup) {
    message += `_${escapeMarkdown(sourceName)} \\- Setup Alert_\n`;
  } else {
    message += `_${escapeMarkdown(sourceName)}_\n`;
  }
  
  const parts = dateFormatter.formatToParts(date);
  const getValue = (type) => parts.find(p => p.type === type)?.value || '';
  
  const timeStr = `${getValue('hour')}:${getValue('minute')} ${getValue('day')}/${getValue('month')}/${getValue('year')}`;
  
  message += `━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🕐 ${timeStr}\n`;
  message += `📱 ${escapeHtml(sourceText)}`;

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
  escapeHtml,
  generateTradeReasons,
  getSetupNameVN,
  translatePattern,
  calculatePercent,
  formatNumber
};
