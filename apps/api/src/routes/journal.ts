/**
 * Journal Routes
 * @module @stock-assist/api/routes/journal
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Journal } from '../models/Journal';
import { validate } from '../middleware/validate';
import { journalCreateBody, journalUpdateBody, idParam } from '../middleware/schemas';

const router = Router();

/** GET /api/journal - Get all notes */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const notes = await Journal.find().sort({ isPinned: -1, createdAt: -1 });
        res.json({ success: true, data: notes });
    } catch (error) {
        next(error);
    }
});

/** POST /api/journal - Create new journal entry */
router.post('/', validate({ body: journalCreateBody }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { content, sentiment, isPinned, type, tradeDetails } = req.body;
        const note = await Journal.create({ content, sentiment, isPinned, type, tradeDetails });
        res.json({ success: true, data: note });
    } catch (error) {
        next(error);
    }
});

/** PUT /api/journal/:id - Update journal entry */
router.put('/:id', validate({ params: idParam, body: journalUpdateBody }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const entry = await Journal.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: entry });
    } catch (error) {
        next(error);
    }
});

/** DELETE /api/journal/:id - Delete note */
router.delete('/:id', validate({ params: idParam }), async (req: Request, res: Response, next: NextFunction) => {
    try {
        await Journal.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

export const journalRouter = router;
