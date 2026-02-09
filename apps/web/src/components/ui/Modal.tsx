'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleEscape);
        }
        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />
            <div
                ref={modalRef}
                className="glass w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-white/10 shadow-2xl relative z-10 animate-in zoom-in-95 duration-300"
            >
                <div className="sticky top-0 z-20 flex items-center justify-between p-6 bg-black/40 backdrop-blur-xl border-b border-white/5">
                    <h2 className="text-xl font-bold text-white">{title || 'Analysis Results'}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6 md:p-8">
                    {children}
                </div>
            </div>
        </div>
    );
}
