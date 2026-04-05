/**
 * Telegram Alert Bot Service
 * Sends trading signals and alerts via Telegram Bot API
 * @module @stock-assist/api/services/notifications/telegram
 */

import { logger } from '../../config/logger';
import { Alert, AlertType } from '../../models/Alert';

const TELEGRAM_API = 'https://api.telegram.org/bot';

interface TelegramResponse {
    ok: boolean;
    result?: { message_id: number };
    description?: string;
}

/** Get bot token — checked at call time so the service can load without env vars */
const getBotToken = (): string => process.env.TELEGRAM_BOT_TOKEN || '';
const getChatId = (): string => process.env.TELEGRAM_CHAT_ID || '';

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(text: string, parseMode: string = 'HTML'): Promise<number | null> {
    const token = getBotToken();
    const chatId = getChatId();

    if (!token || !chatId) {
        logger.warn('Telegram not configured — skipping alert (set TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID)');
        return null;
    }

    try {
        const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: parseMode,
                disable_web_page_preview: true,
            }),
        });

        const data: TelegramResponse = await res.json();

        if (!data.ok) {
            logger.error({ description: data.description }, 'Telegram API error');
            return null;
        }

        return data.result?.message_id ?? null;
    } catch (err) {
        logger.error({ err }, 'Failed to send Telegram message');
        return null;
    }
}

/**
 * Alert: High-confidence signal fired (confidence ≥ 70)
 */
export async function alertHighConfidenceSignal(params: {
    symbol: string;
    direction: 'BUY' | 'SELL';
    confidence: number;
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;
    regime?: string;
    pattern?: string;
}): Promise<void> {
    const { symbol, direction, confidence, entryPrice, targetPrice, stopLoss, regime, pattern } = params;

    const emoji = direction === 'BUY' ? '🟢' : '🔴';
    const rr = Math.abs(targetPrice - entryPrice) / Math.abs(entryPrice - stopLoss);

    const message = [
        `${emoji} <b>${direction} Signal: ${symbol}</b>`,
        ``,
        `📊 Confidence: <b>${confidence}%</b>`,
        `💰 Entry: ₹${entryPrice.toFixed(2)}`,
        `🎯 Target: ₹${targetPrice.toFixed(2)}`,
        `🛑 Stop Loss: ₹${stopLoss.toFixed(2)}`,
        `📐 R:R = 1:${rr.toFixed(1)}`,
        regime ? `📈 Regime: ${regime}` : '',
        pattern ? `🕯 Pattern: ${pattern}` : '',
        ``,
        `⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    ].filter(Boolean).join('\n');

    const messageId = await sendTelegramMessage(message);

    await Alert.create({
        type: AlertType.HIGH_CONFIDENCE_SIGNAL,
        symbol,
        message,
        confidence,
        direction,
        entryPrice,
        targetPrice,
        stopLoss,
        telegramMessageId: messageId,
        delivered: messageId !== null,
        error: messageId === null ? 'Failed to deliver' : undefined,
        metadata: { regime, pattern, rr: rr.toFixed(1) },
    });
}

/**
 * Alert: Stop loss approaching on an open trade
 */
export async function alertStopLossApproaching(params: {
    symbol: string;
    currentPrice: number;
    stopLoss: number;
    entryPrice: number;
    direction: 'BUY' | 'SELL';
}): Promise<void> {
    const { symbol, currentPrice, stopLoss, entryPrice, direction } = params;
    const distPercent = Math.abs((currentPrice - stopLoss) / stopLoss * 100);

    const message = [
        `⚠️ <b>STOP LOSS ALERT: ${symbol}</b>`,
        ``,
        `Price is ${distPercent.toFixed(1)}% from stop loss!`,
        `📍 Current: ₹${currentPrice.toFixed(2)}`,
        `🛑 Stop: ₹${stopLoss.toFixed(2)}`,
        `💰 Entry: ₹${entryPrice.toFixed(2)}`,
        ``,
        `⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    ].join('\n');

    const messageId = await sendTelegramMessage(message);

    await Alert.create({
        type: AlertType.STOP_LOSS_APPROACHING,
        symbol,
        message,
        direction,
        entryPrice,
        stopLoss,
        telegramMessageId: messageId,
        delivered: messageId !== null,
        error: messageId === null ? 'Failed to deliver' : undefined,
        metadata: { currentPrice, distPercent },
    });
}

/**
 * Alert: Target approaching on an open trade
 */
export async function alertTargetApproaching(params: {
    symbol: string;
    currentPrice: number;
    targetPrice: number;
    entryPrice: number;
    direction: 'BUY' | 'SELL';
}): Promise<void> {
    const { symbol, currentPrice, targetPrice, entryPrice, direction } = params;
    const distPercent = Math.abs((currentPrice - targetPrice) / targetPrice * 100);
    const pnlPercent = direction === 'BUY'
        ? ((currentPrice - entryPrice) / entryPrice * 100)
        : ((entryPrice - currentPrice) / entryPrice * 100);

    const message = [
        `🎯 <b>TARGET APPROACHING: ${symbol}</b>`,
        ``,
        `Price is ${distPercent.toFixed(1)}% from target!`,
        `📍 Current: ₹${currentPrice.toFixed(2)}`,
        `🎯 Target: ₹${targetPrice.toFixed(2)}`,
        `📈 Unrealized P&L: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(1)}%`,
        ``,
        `⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    ].join('\n');

    const messageId = await sendTelegramMessage(message);

    await Alert.create({
        type: AlertType.TARGET_APPROACHING,
        symbol,
        message,
        direction,
        entryPrice,
        targetPrice,
        telegramMessageId: messageId,
        delivered: messageId !== null,
        error: messageId === null ? 'Failed to deliver' : undefined,
        metadata: { currentPrice, distPercent, pnlPercent },
    });
}

/**
 * Alert: Morning top 10 stocks ready
 */
export async function alertMorningTop10(stocks: Array<{
    symbol: string;
    direction: 'BUY' | 'SELL';
    confidence: number;
    entryPrice: number;
}>): Promise<void> {
    if (stocks.length === 0) return;

    const lines = stocks.slice(0, 10).map((s, i) => {
        const emoji = s.direction === 'BUY' ? '🟢' : '🔴';
        return `${i + 1}. ${emoji} <b>${s.symbol}</b> — ${s.direction} @ ₹${s.entryPrice.toFixed(2)} (${s.confidence}%)`;
    });

    const message = [
        `🌅 <b>Morning Top ${Math.min(stocks.length, 10)} Signals</b>`,
        ``,
        ...lines,
        ``,
        `⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    ].join('\n');

    const messageId = await sendTelegramMessage(message);

    await Alert.create({
        type: AlertType.MORNING_TOP_10,
        message,
        telegramMessageId: messageId,
        delivered: messageId !== null,
        error: messageId === null ? 'Failed to deliver' : undefined,
        metadata: { stockCount: stocks.length, symbols: stocks.map(s => s.symbol) },
    });
}

/**
 * Alert: Signal resolved (target hit / stop hit)
 */
export async function alertSignalResolved(params: {
    symbol: string;
    direction: 'BUY' | 'SELL';
    status: string;
    pnlPercent: number;
    entryPrice: number;
    outcomePrice: number;
    daysToOutcome: number;
}): Promise<void> {
    const { symbol, direction, status, pnlPercent, entryPrice, outcomePrice, daysToOutcome } = params;

    const emoji = status === 'TARGET_HIT' ? '✅' : status === 'STOP_HIT' ? '❌' : '⏰';
    const statusLabel = status.replace('_', ' ');

    const message = [
        `${emoji} <b>${statusLabel}: ${symbol}</b>`,
        ``,
        `${direction} signal resolved after ${daysToOutcome} day(s)`,
        `💰 Entry: ₹${entryPrice.toFixed(2)} → Exit: ₹${outcomePrice.toFixed(2)}`,
        `📊 P&L: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(1)}%`,
        ``,
        `⏰ ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
    ].join('\n');

    const messageId = await sendTelegramMessage(message);

    await Alert.create({
        type: AlertType.SIGNAL_RESOLVED,
        symbol,
        message,
        direction,
        entryPrice,
        telegramMessageId: messageId,
        delivered: messageId !== null,
        error: messageId === null ? 'Failed to deliver' : undefined,
        metadata: { status, pnlPercent, outcomePrice, daysToOutcome },
    });
}

/**
 * Send a custom message (for testing / ad-hoc alerts)
 */
export async function sendCustomAlert(text: string): Promise<number | null> {
    return sendTelegramMessage(text);
}

/**
 * Verify bot connection — used by the /alerts/test endpoint
 */
export async function verifyBotConnection(): Promise<{ ok: boolean; botName?: string; error?: string }> {
    const token = getBotToken();
    if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not configured' };

    try {
        const res = await fetch(`${TELEGRAM_API}${token}/getMe`);
        const data = await res.json();
        if (data.ok) {
            return { ok: true, botName: data.result.username };
        }
        return { ok: false, error: data.description };
    } catch (err: any) {
        return { ok: false, error: err.message };
    }
}
