/**
 * Watchlist Routes
 * @module @stock-assist/api/routes/watchlist
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Watchlist } from '../models/Watchlist';
import { validate } from '../middleware/validate';
import { watchlistAddBody, symbolParam } from '../middleware/schemas';

const router = Router();

/** GET /api/watchlist - List all followed stocks */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const list = await Watchlist.find().sort({ addedAt: -1 });
        res.json({ success: true, data: list });
    } catch (error) {
        next(error);
    }
});

/** POST /api/watchlist - Add a stock to watchlist */
router.post('/', validate({ body: watchlistAddBody }), async (req: Request, res: Response, next: NextFunction) => {
    const { symbol, notes } = req.body;

    try {
        const entry = await Watchlist.findOneAndUpdate(
            { symbol: symbol.toUpperCase() },
            { symbol: symbol.toUpperCase(), notes, addedAt: new Date() },
            { upsert: true, new: true }
        );
        res.json({ success: true, data: entry });
    } catch (error) {
        next(error);
    }
});

/** DELETE /api/watchlist/:symbol - Remove a stock from watchlist */
router.delete('/:symbol', validate({ params: symbolParam }), async (req: Request, res: Response, next: NextFunction) => {
    const { symbol } = req.params;
    try {
        await Watchlist.findOneAndDelete({ symbol: symbol.toUpperCase() });
        res.json({ success: true, message: 'Removed from watchlist' });
    } catch (error) {
        next(error);
    }
});

export const watchlistRouter = router;
