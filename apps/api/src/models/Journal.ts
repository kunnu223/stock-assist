import mongoose from 'mongoose';

const JournalSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    tags: [String],
    sentiment: {
        type: String,
        enum: ['bullish', 'bearish', 'neutral'],
        default: 'neutral'
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

export const Journal = mongoose.model('Journal', JournalSchema);
