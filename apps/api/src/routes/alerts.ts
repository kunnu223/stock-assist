/**
 * Alert Routes — Telegram notification management
 * @module @stock-assist/api/routes/alerts
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Alert, AlertType } from '../models/Alert';
import {
    verifyBotConnection,
    sendCustomAlert,
    alertMorningTop10,
} from '../services/notifications/telegram';
import { SignalRecord, SignalStatus } from '../models/SignalRecord';
import { logger } from '../config/logger';

export const alertsRouter = Router();

/**
 * GET /api/alerts — List recent alerts with optional filters
 * Query: ?type=HIGH_CONFIDENCE_SIGNAL&symbol=RELIANCE&limit=50&delivered=true
 */
alertsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { type, symbol, limit = '50', delivered } = req.query;
        const filter: Record<string, any> = {};

        if (type) filter.type = type;
        if (symbol) filter.symbol = (symbol as string).toUpperCase();
        if (delivered !== undefined) filter.delivered = delivered === 'true';

        const alerts = await Alert.find(filter)
            .sort({ createdAt: -1 })
            .limit(Math.min(Number(limit), 200))
            .lean();

        res.json({ success: true, count: alerts.length, alerts });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/alerts/stats — Alert delivery statistics
 */
alertsRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const [byType, deliveryStats, recent24h] = await Promise.all([
            Alert.aggregate([
                { $group: { _id: '$type', count: { $sum: 1 }, delivered: { $sum: { $cond: ['$delivered', 1, 0] } } } },
                { $sort: { count: -1 } },
            ]),
            Alert.aggregate([
                { $group: { _id: '$delivered', count: { $sum: 1 } } },
            ]),
            Alert.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
        ]);

        const totalDelivered = deliveryStats.find(d => d._id === true)?.count || 0;
        const totalFailed = deliveryStats.find(d => d._id === false)?.count || 0;

        res.json({
            success: true,
            stats: {
                total: totalDelivered + totalFailed,
                delivered: totalDelivered,
                failed: totalFailed,
                deliveryRate: totalDelivered + totalFailed > 0
                    ? ((totalDelivered / (totalDelivered + totalFailed)) * 100).toFixed(1) + '%'
                    : 'N/A',
                last24h: recent24h,
                byType,
            },
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/alerts/test — Test Telegram bot connection and send a test message
 */
alertsRouter.post('/test', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const connection = await verifyBotConnection();

        if (!connection.ok) {
            res.json({ success: false, error: connection.error });
            return;
        }

        const messageId = await sendCustomAlert(
            `✅ <b>Stock-Assist Bot Connected!</b>\n\nBot: @${connection.botName}\nTime: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
        );

        res.json({
            success: true,
            bot: connection.botName,
            messageDelivered: messageId !== null,
            messageId,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/alerts/morning-top10 — Manually trigger morning top 10 alert
 * Picks the top 10 PENDING signals by confidence (≥ 65) from today
 */
alertsRouter.post('/morning-top10', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const topSignals = await SignalRecord.find({
            status: SignalStatus.PENDING,
            confidence: { $gte: 65 },
            date: { $gte: todayStart },
        })
            .sort({ confidence: -1 })
            .limit(10)
            .lean();

        if (topSignals.length === 0) {
            res.json({ success: true, message: 'No qualifying signals for today', count: 0 });
            return;
        }

        const stocks = topSignals.map(s => ({
            symbol: s.symbol,
            direction: s.direction as 'BUY' | 'SELL',
            confidence: s.confidence,
            entryPrice: s.entryPrice,
        }));

        await alertMorningTop10(stocks);

        logger.info({ count: stocks.length }, 'Morning top 10 alert sent');
        res.json({ success: true, count: stocks.length, symbols: stocks.map(s => s.symbol) });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/alerts/send — Send a custom alert message
 * Body: { message: string }
 */
alertsRouter.post('/send', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { message } = req.body;
        if (!message || typeof message !== 'string') {
            res.status(400).json({ success: false, error: 'message is required' });
            return;
        }

        const messageId = await sendCustomAlert(message);
        res.json({ success: true, delivered: messageId !== null, messageId });
    } catch (error) {
        next(error);
    }
});
