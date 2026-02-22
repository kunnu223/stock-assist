import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
        coverage: {
            provider: 'istanbul',
            reporter: ['text', 'text-summary'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/index.ts'],
        },
    },
    resolve: {
        alias: {
            '@stock-assist/shared': path.resolve(__dirname, '../../packages/shared/src'),
        },
    },
});
