/**
 * Auto Paper Trading Service
 * Every qualifying signal auto-creates a paper trade with ₹1,00,000 virtual capital.
 * Syncs outcomes from SignalRecord resolution.
 * @module @stock-assist/api/services/paperTrading
 */

import { PaperTrade, PaperTradeStatus } from '../../models/PaperTrade';
import { SignalRecord, SignalStatus } from '../../models/SignalRecord';
import { logger } from '../../config/logger';
import type { Types } from 'mongoose';

/** Fixed capital per paper trade for normalization */
const CAPITAL_PER_TRADE = 100_000;

/** Minimum confidence to auto-create a paper trade */
const MIN_CONFIDENCE = 60;

/**
 * Auto-create a paper trade from a signal
 * Called from the analysis orchestrator after saveSignal
 */
export async function createPaperTrade(params: {
    signalId: Types.ObjectId | string;
    symbol: string;
    direction: 'BUY' | 'SELL';
    confidence: number;
    entryPrice: number;
    targetPrice: number;
    stopLoss: number;
    regime: string;
}): Promise<void> {
    const { signalId, symbol, direction, confidence, entryPrice, targetPrice, stopLoss, regime } = params;

    if (confidence < MIN_CONFIDENCE) return;

    // Avoid duplicate paper trades for the same signal
    const existing = await PaperTrade.findOne({ signalId }).lean();
    if (existing) return;

    const quantity = Math.floor(CAPITAL_PER_TRADE / entryPrice);
    if (quantity <= 0) return;

    await PaperTrade.create({
        signalId,
        symbol,
        direction,
        confidence,
        regime,
        entryPrice,
        targetPrice,
        stopLoss,
        capitalAllocated: quantity * entryPrice,
        quantity,
        status: PaperTradeStatus.OPEN,
    });

    logger.info({ symbol, direction, confidence, quantity }, '[PaperTrading] Auto-created paper trade');
}

/**
 * Sync paper trades with resolved signals
 * Called periodically or on-demand to close paper trades whose signals have resolved
 */
export async function syncPaperTrades(): Promise<{ synced: number }> {
    const openTrades = await PaperTrade.find({ status: PaperTradeStatus.OPEN });
    let synced = 0;

    for (const trade of openTrades) {
        const signal = await SignalRecord.findById(trade.signalId).lean();
        if (!signal) continue;

        if (signal.status === SignalStatus.PENDING || signal.status === SignalStatus.PARTIAL_PROFIT) {
            // Still open — update unrealized P&L if we have an outcome price hint
            continue;
        }

        // Signal resolved — close the paper trade
        const exitPrice = signal.outcomePrice || signal.entryPrice;
        const pnl = trade.direction === 'BUY'
            ? (exitPrice - trade.entryPrice) * trade.quantity
            : (trade.entryPrice - exitPrice) * trade.quantity;
        const pnlPercent = signal.pnlPercent || 0;

        let status: PaperTradeStatus;
        switch (signal.status) {
            case SignalStatus.TARGET_HIT:
                status = PaperTradeStatus.CLOSED_TARGET;
                break;
            case SignalStatus.STOP_HIT:
                status = PaperTradeStatus.CLOSED_STOP;
                break;
            case SignalStatus.EXPIRED:
                status = PaperTradeStatus.CLOSED_EXPIRED;
                break;
            default:
                status = PaperTradeStatus.CLOSED_PARTIAL;
        }

        trade.status = status;
        trade.exitPrice = exitPrice;
        trade.exitDate = signal.outcomeDate || new Date();
        trade.exitReason = signal.exitReason || signal.status;
        trade.realizedPnl = Number(pnl.toFixed(2));
        trade.realizedPnlPercent = Number(pnlPercent.toFixed(2));
        trade.daysHeld = signal.daysToOutcome || 0;

        await trade.save();
        synced++;
    }

    if (synced > 0) {
        logger.info({ synced }, '[PaperTrading] Synced paper trades with signal outcomes');
    }

    return { synced };
}

/**
 * Update unrealized P&L for open paper trades given current prices
 */
export async function updateUnrealizedPnl(priceMap: Record<string, number>): Promise<number> {
    const openTrades = await PaperTrade.find({ status: PaperTradeStatus.OPEN });
    let updated = 0;

    for (const trade of openTrades) {
        const currentPrice = priceMap[trade.symbol];
        if (!currentPrice) continue;

        trade.currentPrice = currentPrice;
        const pnl = trade.direction === 'BUY'
            ? (currentPrice - trade.entryPrice) * trade.quantity
            : (trade.entryPrice - currentPrice) * trade.quantity;
        const pnlPercent = trade.direction === 'BUY'
            ? ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100
            : ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100;

        trade.unrealizedPnl = Number(pnl.toFixed(2));
        trade.unrealizedPnlPercent = Number(pnlPercent.toFixed(2));
        await trade.save();
        updated++;
    }

    return updated;
}

/**
 * Get portfolio summary — total P&L, win rate, open positions
 */
export async function getPortfolioSummary(): Promise<{
    openPositions: number;
    closedTrades: number;
    totalRealizedPnl: number;
    totalUnrealizedPnl: number;
    winRate: string;
    avgHoldingDays: number;
    totalCapitalDeployed: number;
    profitFactor: string;
}> {
    const [openCount, closedTrades] = await Promise.all([
        PaperTrade.countDocuments({ status: PaperTradeStatus.OPEN }),
        PaperTrade.find({ status: { $ne: PaperTradeStatus.OPEN } }).lean(),
    ]);

    const openTrades = await PaperTrade.find({ status: PaperTradeStatus.OPEN }).lean();

    const totalRealizedPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
    const totalUnrealizedPnl = openTrades.reduce((sum, t) => sum + (t.unrealizedPnl || 0), 0);
    const totalCapitalDeployed = [...openTrades, ...closedTrades].reduce((sum, t) => sum + t.capitalAllocated, 0);

    const wins = closedTrades.filter(t =>
        t.status === PaperTradeStatus.CLOSED_TARGET || (t.realizedPnl && t.realizedPnl > 0)
    ).length;
    const winRate = closedTrades.length > 0
        ? ((wins / closedTrades.length) * 100).toFixed(1) + '%'
        : 'N/A';

    const totalDays = closedTrades.reduce((sum, t) => sum + (t.daysHeld || 0), 0);
    const avgHoldingDays = closedTrades.length > 0 ? Number((totalDays / closedTrades.length).toFixed(1)) : 0;

    const grossProfit = closedTrades.filter(t => (t.realizedPnl || 0) > 0).reduce((s, t) => s + (t.realizedPnl || 0), 0);
    const grossLoss = Math.abs(closedTrades.filter(t => (t.realizedPnl || 0) < 0).reduce((s, t) => s + (t.realizedPnl || 0), 0));
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '∞' : 'N/A';

    return {
        openPositions: openCount,
        closedTrades: closedTrades.length,
        totalRealizedPnl: Number(totalRealizedPnl.toFixed(2)),
        totalUnrealizedPnl: Number(totalUnrealizedPnl.toFixed(2)),
        winRate,
        avgHoldingDays,
        totalCapitalDeployed: Number(totalCapitalDeployed.toFixed(2)),
        profitFactor,
    };
}
