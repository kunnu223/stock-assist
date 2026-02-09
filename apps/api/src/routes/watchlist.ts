import { Router } from 'express';
import { Watchlist } from '../models/Watchlist';

const router = Router();

// GET /api/watchlist - List all followed stocks
router.get('/', async (req, res) => {
    try {
        const list = await Watchlist.find().sort({ addedAt: -1 });
        res.json({ success: true, data: list });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch watchlist' });
    }
});

// POST /api/watchlist - Add a stock to watchlist
router.post('/', async (req, res) => {
    const { symbol, notes } = req.body;
    if (!symbol) {
        return res.status(400).json({ success: false, message: 'Symbol is required' });
    }

    try {
        const entry = await Watchlist.findOneAndUpdate(
            { symbol: symbol.toUpperCase() },
            { symbol: symbol.toUpperCase(), notes, addedAt: new Date() },
            { upsert: true, new: true }
        );
        res.json({ success: true, data: entry });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to add to watchlist' });
    }
});

// DELETE /api/watchlist/:symbol - Remove a stock from watchlist
router.delete('/:symbol', async (req, res) => {
    const { symbol } = req.params;
    try {
        await Watchlist.findOneAndDelete({ symbol: symbol.toUpperCase() });
        res.json({ success: true, message: 'Removed from watchlist' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove from watchlist' });
    }
});

export const watchlistRouter = router;
