'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, Pin, Calendar, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Note {
    _id: string;
    content: string;
    sentiment: 'neutral' | 'bullish' | 'bearish';
    isPinned: boolean;
    createdAt: string;
}

export default function JournalPage() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNote, setNewNote] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        try {
            const res = await fetch('/api/journal');
            const data = await res.json();
            if (data.success) {
                setNotes(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch notes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const addNote = async () => {
        if (!newNote.trim()) return;
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/journal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: newNote,
                    sentiment: 'neutral',
                    isPinned: false
                })
            });
            const data = await res.json();
            if (data.success) {
                setNotes([data.data, ...notes]);
                setNewNote('');
            }
        } catch (error) {
            console.error('Failed to add note:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const deleteNote = async (id: string) => {
        try {
            await fetch(`/api/journal/${id}`, { method: 'DELETE' });
            setNotes(notes.filter(n => n._id !== id));
        } catch (error) {
            console.error('Failed to delete note:', error);
        }
    };

    return (
        <div className="space-y-6 md:space-y-12 max-w-7xl mx-auto pb-24 pt-1 md:pt-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6 md:pb-10">
                <div className="space-y-3 md:space-y-4">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-foreground uppercase italic">
                        TRADING <span className="text-primary-500">JOURNAL</span>
                    </h1>
                    <p className="text-lg text-muted-foreground font-medium max-w-2xl text-balance">
                        Record your thoughts, strategies, and market observations.
                    </p>
                </div>
            </div>

            {/* Input Area */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 md:p-6 backdrop-blur-sm">
                <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Write your observation..."
                    className="w-full bg-transparent border-none text-lg text-foreground placeholder:text-zinc-600 focus:ring-0 resize-none min-h-[120px]"
                />
                <div className="flex justify-between items-center mt-4 border-t border-zinc-800 pt-4">
                    <span className="text-xs text-zinc-500 font-mono">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    <button
                        onClick={addNote}
                        disabled={isSubmitting || !newNote.trim()}
                        className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-lg font-bold text-sm tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                        ADD NOTE
                    </button>
                </div>
            </div>

            {/* Notes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <AnimatePresence>
                    {notes.map((note) => (
                        <motion.div
                            key={note._id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            layout
                            className="group relative bg-zinc-950 border border-zinc-900 rounded-xl p-5 hover:border-zinc-800 transition-colors"
                        >
                            <p className="text-zinc-300 font-medium whitespace-pre-wrap mb-8 leading-relaxed">
                                {note.content}
                            </p>

                            <div className="absolute bottom-4 left-5 right-5 flex justify-between items-center pt-4 border-t border-zinc-900 group-hover:border-zinc-800 transition-colors">
                                <div className="flex items-center gap-2 text-xs text-zinc-600 font-mono">
                                    <Calendar size={12} />
                                    {new Date(note.createdAt).toLocaleDateString()}
                                </div>
                                <button
                                    onClick={() => deleteNote(note._id)}
                                    className="text-zinc-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {!isLoading && notes.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                        <BookOpen className="w-16 h-16 text-zinc-800 mx-auto mb-4" />
                        <p className="text-zinc-500 text-lg font-medium">Your journal is empty</p>
                        <p className="text-zinc-700 text-sm mt-2">Start tracking your trading journey today.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
