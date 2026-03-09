/**
 * Database Connection
 * @module @stock-assist/api/config/db
 */

import mongoose from 'mongoose';
import { logger } from './logger';

let isConnected = false;

export const connectDB = async (): Promise<void> => {
    if (isConnected) return;

    const uri = process.env.MONGODB_URI;
    if (!uri || uri.includes('<db_password>') || uri.includes('demo:demo')) {
        logger.warn('MongoDB credentials not fully set. Data persistence disabled (Demo Mode).');
        return;
    }

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 10,
            minPoolSize: 2,
            socketTimeoutMS: 45000,
        });
        isConnected = true;
        logger.info('MongoDB connected');
    } catch (error) {
        logger.error({ err: error }, 'MongoDB connection failed');
        // Don't throw the error, just let the app run in fallback mode
    }
};

export const getDB = () => mongoose.connection;
