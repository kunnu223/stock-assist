'use client';

import { Loader2, PlayCircle } from 'lucide-react';

interface Props {
    onClick: () => void;
    loading: boolean;
}

export function AnalysisButton({ onClick, loading }: Props) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-500 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 disabled:scale-100"
        >
            {loading ? (
                <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Analyzing...</span>
                </>
            ) : (
                <>
                    <PlayCircle size={20} />
                    <span>Run Analysis</span>
                </>
            )}
        </button>
    );
}
