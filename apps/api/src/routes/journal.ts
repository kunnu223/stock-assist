import { Router, Request, Response } from 'express';
import { Journal } from '../models/Journal';

const router = Router();

// GET all notes
router.get('/', async (req: Request, res: Response) => {
    try {
        const notes = await Journal.find().sort({ isPinned: -1, createdAt: -1 });
        res.json({ success: true, data: notes });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});

// POST new journal entry (note or trade)
router.post('/', async (req: Request, res: Response) => {
    try {
        const { content, sentiment, isPinned, type, tradeDetails } = req.body;
        const note = await Journal.create({ content, sentiment, isPinned, type, tradeDetails });
        res.json({ success: true, data: note });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});

// UPDATE journal entry (e.g. close trade)
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const entry = await Journal.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: entry });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});

// DELETE note
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await Journal.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: String(error) });
    }
});

export const journalRouter = router;
