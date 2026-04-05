/**
 * Risk Dashboard Routes — real-time portfolio risk monitoring
 * Phase 4.4: Total open risk, sector concentration, worst-case, weekly P&L curve
 * @module @stock-assist/api/routes/risk
 */

import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { SignalRecord, SignalStatus } from '../models/SignalRecord';
import { PaperTrade, PaperTradeStatus } from '../models/PaperTrade';

export const riskRouter = Router();

const requireDB = (_req: Request, res: Response, next: any) => {
    if (mongoose.connection.readyState !== 1) {
        return res.json({ success: false, error: 'Database not connected' });
    }
    next();
};

/**
 * GET /api/risk/dashboard — Full risk dashboard
 * Shows: open risk, sector concentration, worst-case, recent P&L
 */
riskRouter.get('/dashboard', requireDB, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        // Fetch all open paper trades and pending signals
        const [openTrades, pendingSignals] = await Promise.all([
            PaperTrade.find({ status: PaperTradeStatus.OPEN }).lean(),
            SignalRecord.find({
                status: { $in: [SignalStatus.PENDING, SignalStatus.PARTIAL_PROFIT] },
            }).lean(),
        ]);

        // ── Total Open Risk (₹ at stake if all stops hit) ──
        let totalCapitalDeployed = 0;
        let totalRiskAtStake = 0;
        let totalUnrealizedPnl = 0;

        const positionDetails: Array<{
            symbol: string;
            direction: string;
            entryPrice: number;
            stopLoss: number;
            capitalAllocated: number;
            riskAmount: number;
            riskPercent: number;
            unrealizedPnl: number;
        }> = [];

        for (const trade of openTrades) {
            const riskPerShare = Math.abs(trade.entryPrice - trade.stopLoss);
            const riskAmount = riskPerShare * trade.quantity;
            const riskPercent = (riskPerShare / trade.entryPrice) * 100;

            totalCapitalDeployed += trade.capitalAllocated;
            totalRiskAtStake += riskAmount;
            totalUnrealizedPnl += trade.unrealizedPnl || 0;

            positionDetails.push({
                symbol: trade.symbol,
                direction: trade.direction,
                entryPrice: trade.entryPrice,
                stopLoss: trade.stopLoss,
                capitalAllocated: trade.capitalAllocated,
                riskAmount: Number(riskAmount.toFixed(2)),
                riskPercent: Number(riskPercent.toFixed(2)),
                unrealizedPnl: trade.unrealizedPnl || 0,
            });
        }

        // ── Sector Concentration ──
        // Group open positions by symbol prefix (first word as proxy for sector)
        const sectorMap: Record<string, { count: number; capital: number; risk: number }> = {};
        for (const pos of positionDetails) {
            const sector = pos.symbol; // Each stock is its own concentration unit
            if (!sectorMap[sector]) sectorMap[sector] = { count: 0, capital: 0, risk: 0 };
            sectorMap[sector].count++;
            sectorMap[sector].capital += pos.capitalAllocated;
            sectorMap[sector].risk += pos.riskAmount;
        }

        const concentrationWarnings: string[] = [];
        const totalCap = totalCapitalDeployed || 1;
        for (const [sym, data] of Object.entries(sectorMap)) {
            const pct = (data.capital / totalCap) * 100;
            if (pct > 25) {
                concentrationWarnings.push(`⚠️ ${sym}: ${pct.toFixed(1)}% of deployed capital (>${25}% threshold)`);
            }
        }

        if (openTrades.length > 10) {
            concentrationWarnings.push(`⚠️ ${openTrades.length} open positions — consider reducing exposure`);
        }

        // ── Worst-Case Scenario ──
        const worstCaseLoss = totalRiskAtStake;
        const worstCasePercent = totalCapitalDeployed > 0
            ? (worstCaseLoss / totalCapitalDeployed) * 100
            : 0;

        // ── Weekly P&L Curve ──
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

        const closedRecent = await PaperTrade.find({
            status: { $ne: PaperTradeStatus.OPEN },
            exitDate: { $gte: fourWeeksAgo },
        })
            .sort({ exitDate: 1 })
            .lean();

        // Group by week
        const weeklyPnl: Array<{ week: string; pnl: number; trades: number; wins: number }> = [];
        const weekMap = new Map<string, { pnl: number; trades: number; wins: number }>();

        for (const trade of closedRecent) {
            if (!trade.exitDate) continue;
            const d = new Date(trade.exitDate);
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay()); // Sunday start
            const key = weekStart.toISOString().split('T')[0];

            if (!weekMap.has(key)) weekMap.set(key, { pnl: 0, trades: 0, wins: 0 });
            const week = weekMap.get(key)!;
            week.pnl += trade.realizedPnl || 0;
            week.trades++;
            if ((trade.realizedPnl || 0) > 0) week.wins++;
        }

        for (const [week, data] of weekMap) {
            weeklyPnl.push({
                week,
                pnl: Number(data.pnl.toFixed(2)),
                trades: data.trades,
                wins: data.wins,
            });
        }
        weeklyPnl.sort((a, b) => a.week.localeCompare(b.week));

        // ── Risk Score (0-100, higher = more risky) ──
        let riskScore = 0;
        if (openTrades.length > 0) riskScore += Math.min(openTrades.length * 5, 30);
        if (worstCasePercent > 10) riskScore += 20;
        else if (worstCasePercent > 5) riskScore += 10;
        if (concentrationWarnings.length > 0) riskScore += concentrationWarnings.length * 10;
        if (totalUnrealizedPnl < 0) riskScore += Math.min(Math.abs(totalUnrealizedPnl) / 1000, 20);
        riskScore = Math.min(riskScore, 100);

        const riskLevel = riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MODERATE' : 'LOW';

        res.json({
            success: true,
            dashboard: {
                // Summary
                riskScore: Math.round(riskScore),
                riskLevel,
                openPositions: openTrades.length,
                pendingSignals: pendingSignals.length,

                // Capital
                totalCapitalDeployed: Number(totalCapitalDeployed.toFixed(2)),
                totalUnrealizedPnl: Number(totalUnrealizedPnl.toFixed(2)),

                // Risk
                totalRiskAtStake: Number(totalRiskAtStake.toFixed(2)),
                worstCase: {
                    loss: Number(worstCaseLoss.toFixed(2)),
                    percent: Number(worstCasePercent.toFixed(2)),
                    description: `If all ${openTrades.length} stops hit: ₹${worstCaseLoss.toFixed(0)} loss (${worstCasePercent.toFixed(1)}%)`,
                },

                // Concentration
                concentrationWarnings,
                positions: positionDetails,

                // Weekly P&L
                weeklyPnl,
            },
        });
    } catch (error) {
        next(error);
    }
});
