/**
 * Watchlist Routes
 * @module @stock-assist/api/routes/watchlist
 */

import { Router, Request, Response } from 'express';
import { Watchlist } from '../models';
import { DEFAULT_WATCHLIST } from '@stock-assist/shared';

export const watchlistRouter = Router();

/** GET /api/watchlist - Get watchlist */
watchlistRouter.get('/', async (_req: Request, res: Response) => {
    try {
        let watchlist = await Watchlist.findOne({ userId: 'default' });

        if (!watchlist) {
            const symbols = DEFAULT_WATCHLIST.map((s: any) => typeof s === 'string' ? s : s.symbol);
            watchlist = new Watchlist({
                userId: 'default',
                stocks: symbols,
            });
            await watchlist.save();
        }

        res.json({ success: true, stocks: watchlist.stocks });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});

/** POST /api/watchlist - Add stock */
watchlistRouter.post('/', async (req: Request, res: Response) => {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ success: false, error: 'Symbol required' });

    try {
        let watchlist = await Watchlist.findOne({ userId: 'default' });
        if (!watchlist) watchlist = new Watchlist({ userId: 'default', stocks: [] });

        const upper = symbol.toUpperCase();
        if (!watchlist.stocks.includes(upper)) {
            watchlist.stocks.push(upper);
            await watchlist.save();
        }

        res.json({ success: true, stocks: watchlist.stocks });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});

/** DELETE /api/watchlist/:symbol - Remove stock */
watchlistRouter.delete('/:symbol', async (req: Request, res: Response) => {
    try {
        const watchlist = await Watchlist.findOne({ userId: 'default' });
        if (watchlist) {
            watchlist.stocks = watchlist.stocks.filter((s: string) => s !== req.params.symbol.toUpperCase());
            await watchlist.save();
        }
        res.json({ success: true, stocks: watchlist?.stocks || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});
