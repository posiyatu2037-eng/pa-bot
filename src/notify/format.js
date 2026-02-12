/**
 * Format trading signals for Telegram messages
 * HTML-only (Telegram parse_mode: 'HTML')
 * ENTRY-only by default (SETUP will be formatted as a short note if ever sent).
 */

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatNumber(num, decimals = 2) {
  if (typeof num !== 'number' || Number.isNaN(num)) return '--';
  return num.toFixed(decimals);
}

function calculatePercent(from, to) {
  if (typeof from !== 'number' || typeof to !== 'number' || from === 0) return null;
  return ((to - from) / from) * 100;
}

const PATTERN_TRANSLATIONS = {
  Hammer: 'Búa (Hammer)',
  'Shooting Star': 'Sao Băng (Shooting Star)',
  'Bullish Engulfing': 'Nhấn chìm tăng (Bullish Engulfing)',
  'Bearish Engulfing': 'Nhấn chìm giảm (Bearish Engulfing)',
  Doji: 'Doji'
};

function translatePattern(patternName, patternType) {
  if (!patternName) return 'Không xác định';

  if (PATTERN_TRANSLATIONS[patternName]) return PATTERN_TRANSLATIONS[patternName];

  if (patternName.includes('Hammer')) return PATTERN_TRANSLATIONS.Hammer;
  if (patternName.includes('Shooting Star')) return PATTERN_TRANSLATIONS['Shooting Star'];
  if (patternName.includes('Engulfing')) {
    return patternType === 'bullish'
      ? PATTERN_TRANSLATIONS['Bullish Engulfing']
      : PATTERN_TRANSLATIONS['Bearish Engulfing'];
  }
  if (patternName.includes('Doji')) return PATTERN_TRANSLATIONS.Doji;

  return patternName;
}

function getSetupNameVN(setup) {
  if (!setup || !setup.type) return 'Không xác định';

  const setupType = String(setup.type).toLowerCase();

  if (setupType === 'reversal') return 'Đảo chiều';
  if (setupType === 'breakout') return 'Vượt vùng';
  if (setupType === 'breakdown') return 'Vượt vùng xuống';
  if (setupType === 'retest') return 'Test lại';
  if (setupType === 'false_breakout' || setupType === 'false_breakdown') return 'Bẫy breakout';

  return setup.type;
}

function generateTradeReasons(signal) {
  const reasons = [];

  const { setup, htfBias, divergence, volumeRatio } = signal || {};

  // HTF bias
  if (htfBias && htfBias.bias && htfBias.bias !== 'neutral') {
    const biasVN = htfBias.bias === 'bullish' ? 'TĂNG' : 'GIẢM';
    const structures = htfBias.structures || {};
    const d1 =
      structures['1d'] === 'up' ? 'tăng' : structures['1d'] === 'down' ? 'giảm' : 'ngang';
    const h4 =
      structures['4h'] === 'up' ? 'tăng' : structures['4h'] === 'down' ? 'giảm' : 'ngang';

    reasons.push(`Xu hướng lớn ${biasVN} (1D ${d1}, 4H ${h4})`);
  }

  // Pattern
  if (setup && setup.pattern) {
    const patternVN = translatePattern(setup.pattern.name || 'Unknown', setup.pattern.type);
    const strength = Math.round((setup.pattern.strength || 0) * 100);
    reasons.push(`Mô hình nến ${patternVN} (độ mạnh ${strength}%)`);
  }

  // Setup/zone context
  if (setup && setup.type) {
    const t = String(setup.type).toLowerCase();

    if (t === 'reversal') {
      const zoneType = setup.zone?.type === 'support' ? 'hỗ trợ' : 'kháng cự';
      reasons.push(`Đảo chiều tại vùng ${zoneType}`);
    } else if (t === 'breakout' || t === 'breakdown') {
      reasons.push(setup.isTrue ? 'Breakout thật (có xác nhận)' : 'Breakout yếu (nguy cơ trap)');
    } else if (t === 'retest') {
      reasons.push('Retest vùng đã vỡ (kèo theo xu hướng)');
    } else if (t === 'false_breakout' || t === 'false_breakdown') {
      reasons.push('Bẫy breakout (quét wick rồi quay lại vùng)');
    }
  }

  // Volume
  if (typeof volumeRatio === 'number') {
    if (volumeRatio >= 2.0) reasons.push(`Volume cực mạnh (${formatNumber(volumeRatio, 1)}x TB)`);
    else if (volumeRatio >= 1.5) reasons.push(`Volume tăng (${formatNumber(volumeRatio, 1)}x TB)`);
    else if (volumeRatio < 0.8) reasons.push(`Volume yếu (${formatNumber(volumeRatio, 1)}x TB)`);
  }

  // RSI divergence (optional bonus)
  if (divergence && (divergence.bullish || divergence.bearish)) {
    reasons.push(divergence.bullish ? 'Phân kỳ tăng (bonus)' : 'Phân kỳ giảm (bonus)');
  }

  return reasons;
}

function formatTime(timestamp) {
  const date = new Date(timestamp || Date.now());
  const timezone = process.env.TELEGRAM_TIMEZONE || 'Asia/Ho_Chi_Minh';

  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false
  });

  const parts = fmt.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('hour')}:${get('minute')} ${get('day')}/${get('month')}/${get('year')}`;
}

function formatSignalMessage(signal) {
  if (!signal) return '';

  const stage = String(signal.stage || 'ENTRY').toUpperCase();

  // ENTRY-only: if something still sends SETUP, make it short and safe
  if (stage !== 'ENTRY') {
    const sideEmoji = signal.side === 'LONG' ? '🟢' : '🔴';
    const setupName = getSetupNameVN(signal.setup);
    return (
      `${sideEmoji} <b>SETUP | ${escapeHtml(signal.symbol)} | ${escapeHtml(
        String(signal.timeframe || '').toUpperCase()
      )}</b>\n` +
      `<b>${escapeHtml(setupName)}</b>\n` +
      `🕐 ${escapeHtml(formatTime(signal.timestamp))}\n` +
      `⚠️ Chỉ là cảnh báo sớm (SETUP).`
    );
  }

  const { symbol, timeframe, side, score, levels, setup } = signal;

  const sideText = side === 'LONG' ? 'LONG' : 'SHORT';
  const sideEmoji = side === 'LONG' ? '🟢' : '🔴';
  const setupName = getSetupNameVN(setup);
  const sourceText = process.env.SIGNAL_SOURCE_TEXT || 'Posiya Tú zalo 0763888872';

  if (!levels || typeof levels.entry !== 'number' || typeof levels.stopLoss !== 'number') {
    // Fail-safe formatting
    return (
      `${sideEmoji} <b>${escapeHtml(sideText)} | ${escapeHtml(symbol)} | ${escapeHtml(
        String(timeframe || '').toUpperCase()
      )}</b>\n` +
      `<b>${escapeHtml(setupName)}</b>\n` +
      `Điểm tín hiệu: <b>${escapeHtml(score ?? '--')}</b>/100\n` +
      `🕐 ${escapeHtml(formatTime(signal.timestamp))}\n` +
      `📱 ${escapeHtml(sourceText)}`
    );
  }

  const entry = levels.entry;
  const sl = levels.stopLoss;
  const slPercent = calculatePercent(entry, sl);

  const tp1 = levels.takeProfit1;
  const tp2 = levels.takeProfit2;

  const tp1Percent = typeof tp1 === 'number' ? calculatePercent(entry, tp1) : null;
  const tp2Percent = typeof tp2 === 'number' ? calculatePercent(entry, tp2) : null;

  const rr1 = levels.riskReward1;
  const rr2 = levels.riskReward2;

  let msg = '';
  msg += `${sideEmoji} <b>${escapeHtml(sideText)} | ${escapeHtml(symbol)} | ${escapeHtml(
    String(timeframe || '').toUpperCase()
  )}</b>\n`;
  msg += `<b>${escapeHtml(setupName)}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `<b>📋 KẾ HOẠCH GIAO DỊCH</b>\n`;
  msg += `Entry: <code>${formatNumber(entry, 8)}</code>\n`;

  msg += `SL: <code>${formatNumber(sl, 8)}</code>`;
  if (slPercent !== null) msg += ` (${formatNumber(Math.abs(slPercent), 2)}%)`;
  if (levels.slZone?.type) {
    const z = levels.slZone.type === 'support' ? 'support' : 'resistance';
    msg += ` <i>[${escapeHtml(z)}]</i>`;
  }
  msg += `\n`;

  if (typeof tp1 === 'number') {
    msg += `TP1: <code>${formatNumber(tp1, 8)}</code>`;
    if (tp1Percent !== null) msg += ` (${formatNumber(Math.abs(tp1Percent), 2)}%)`;
    if (typeof rr1 === 'number') msg += ` <b>[${formatNumber(rr1, 1)}R]</b>`;
    if (levels.tpZones?.[0]?.type) msg += ` <i>[${escapeHtml(levels.tpZones[0].type)}]</i>`;
    msg += `\n`;
  }

  if (typeof tp2 === 'number') {
    msg += `TP2: <code>${formatNumber(tp2, 8)}</code>`;
    if (tp2Percent !== null) msg += ` (${formatNumber(Math.abs(tp2Percent), 2)}%)`;
    if (typeof rr2 === 'number') msg += ` <b>[${formatNumber(rr2, 1)}R]</b>`;
    if (levels.tpZones?.[1]?.type) msg += ` <i>[${escapeHtml(levels.tpZones[1].type)}]</i>`;
    msg += `\n`;
  }

  msg += `\n`;

  if (typeof rr1 === 'number') {
    msg += `<b>Risk/Reward:</b> ${escapeHtml(formatNumber(rr1, 2))}R\n\n`;
  }

  msg += `<b>Điểm tín hiệu:</b> ${escapeHtml(score)}/100\n\n`;

  msg += `<b>💡 Lý do vào kèo</b>\n`;
  const reasons = generateTradeReasons(signal);
  if (reasons.length) {
    for (const r of reasons) msg += `✅ ${escapeHtml(r)}\n`;
  } else {
    msg += `✅ Price Action + Volume (tổng hợp)\n`;
  }
  msg += `\n`;

  if (signal.chaseEval && signal.chaseEval.decision) {
    const decision = String(signal.chaseEval.decision);
    const reason = escapeHtml(signal.chaseEval.reason || '');
    if (decision === 'CHASE_OK') msg += `✅ <b>Anti-chase:</b> ${reason}\n\n`;
    else if (decision === 'REVERSAL_WATCH') msg += `🔄 <b>Anti-chase:</b> ${reason}\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🕐 ${escapeHtml(formatTime(signal.timestamp))}\n`;
  msg += `📱 ${escapeHtml(sourceText)}`;

  return msg;
}

function formatSimpleMessage(signal) {
  const entry = signal?.levels?.entry;
  return `[SIGNAL] ${signal?.symbol} ${signal?.timeframe} ${signal?.side} @ ${entry} | Score: ${signal?.score}`;
}

module.exports = {
  escapeHtml,
  formatNumber,
  calculatePercent,
  translatePattern,
  getSetupNameVN,
  generateTradeReasons,
  formatSignalMessage,
  formatSimpleMessage
};
