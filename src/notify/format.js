/**
 * Format trading signals for Telegram messages
 * Uses Markdown with monospace tables
 */

/**
 * Escape special Markdown characters for Telegram
 * MarkdownV2 requires escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
 */
function escapeMarkdown(text) {
  if (typeof text !== 'string') {
    text = String(text);
  }
  // Escape special characters for MarkdownV2
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Format a number for display
 */
function formatNumber(num, decimals = 2) {
  return num.toFixed(decimals);
}

/**
 * Calculate confidence level based on score
 */
function getConfidenceLevel(score) {
  if (score >= 85) return '🟢 RẤT CAO';
  if (score >= 75) return '🟡 CAO';
  if (score >= 65) return '🟠 TRUNG BÌNH';
  return '🔴 THẤP';
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
      reasons.push(`✅ Xu hướng lớn ${biasVN} rõ ràng (1D ${d1}, 4H ${h4})`);
    } else {
      reasons.push(`⚠️ Xu hướng lớn ${biasVN} nhưng chưa đồng bộ hoàn toàn`);
    }
  }
  
  // Pattern analysis
  if (setup.pattern) {
    const patternVN = translatePattern(setup.pattern.name || 'Unknown', setup.pattern.type);
    const strength = Math.round(setup.pattern.strength * 100);
    reasons.push(`📊 Mô hình nến ${patternVN} (độ mạnh ${strength}%)`);
  }
  
  // Setup type analysis
  const setupType = setup.type || '';
  if (setupType === 'reversal') {
    const zoneType = setup.zone?.type === 'support' ? 'hỗ trợ' : 'kháng cự';
    reasons.push(`🔄 Đảo chiều tại vùng ${zoneType} mạnh`);
  } else if (setupType === 'breakout' || setupType === 'breakdown') {
    if (setup.isTrue) {
      reasons.push(`🚀 Breakout THẬT - có volume xác nhận mạnh`);
    } else {
      reasons.push(`⚠️ Breakout GIẢ - volume yếu, có thể trap`);
    }
  } else if (setupType === 'retest') {
    reasons.push(`✅ Retest vùng đã vỡ - cơ hội vào lệnh tốt`);
  } else if (setupType === 'false_breakout' || setupType === 'false_breakdown') {
    reasons.push(`💡 Bẫy breakout giả - wick dài nhưng close lại trong vùng`);
  }
  
  // Volume analysis
  if (volumeRatio) {
    if (volumeRatio > 2.0) {
      reasons.push(`📈 Volume CỰC MẠNH (${formatNumber(volumeRatio, 1)}x TB) - tín hiệu rất tích cực`);
    } else if (volumeRatio > 1.5) {
      reasons.push(`📊 Volume tăng mạnh (${formatNumber(volumeRatio, 1)}x TB) - xác nhận tốt`);
    } else if (volumeRatio < 0.8) {
      reasons.push(`⚠️ Volume yếu (${formatNumber(volumeRatio, 1)}x TB) - cần thận trọng`);
    }
  }
  
  // RSI Divergence
  if (divergence && (divergence.bullish || divergence.bearish)) {
    const divType = divergence.bullish ? 'Phân kỳ tăng' : 'Phân kỳ giảm';
    reasons.push(`📉 ${divType} - tín hiệu đảo chiều mạnh`);
  }
  
  return reasons;
}

/**
 * Format signal as Telegram message in Vietnamese
 * Supports both SETUP (early warning) and ENTRY (confirmed) stages
 * @param {Object} signal - Complete signal object
 * @returns {string} Formatted Markdown message
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
  
  // Build the message
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

  // === ĐỘ TIN CẬY ===
  message += `*━━━ ĐỘ TIN CẬY ━━━*\n`;
  message += `${getConfidenceLevel(score)} *${score}/100 điểm*\n\n`;
  
  // HTF Analysis
  if (htfBias && htfBias.bias !== 'neutral') {
    const structures = htfBias.structures || {};
    const d1VN = structures['1d'] === 'up' ? '🟢 Tăng' : structures['1d'] === 'down' ? '🔴 Giảm' : '⚪ Ngang';
    const h4VN = structures['4h'] === 'up' ? '🟢 Tăng' : structures['4h'] === 'down' ? '🔴 Giảm' : '⚪ Ngang';
    const alignIcon = htfBias.alignment ? '✅' : '⚠️';
    message += `${alignIcon} *Khung lớn:* 1D ${d1VN} \\| 4H ${h4VN}\n\n`;
  }

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
  const reasons = generateTradeReasons(signal, setup, htfBias, divergence, volumeRatio);
  for (const reason of reasons) {
    message += `${escapeMarkdown(reason)}\n`;
  }
  message += '\n';

  // Timestamp and footer
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
  message += `🕐 ${escapeMarkdown(timeStr)}\n`;
  
  // Add stage indicator to footer
  if (isSetup) {
    message += `_${escapeMarkdown(sourceName)} \\- Setup Alert_\n`;
  } else {
    message += `_${escapeMarkdown(sourceName)}_\n`;
  }

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
  escapeMarkdown,
  generateTradeReasons,
  getConfidenceLevel
};
