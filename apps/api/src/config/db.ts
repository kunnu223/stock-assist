/**
 * Database Connection
 * @module @stock-assist/api/config/db
 */

import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async (): Promise<void> => {
    if (isConnected) return;

    const uri = process.env.MONGODB_URI;
    if (!uri || uri.includes('<db_password>') || uri.includes('demo:demo')) {
        console.warn('⚠️ MongoDB credentials not fully set. Data persistence disabled (Demo Mode).');
        return;
    }

    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        isConnected = true;
        console.log('✅ MongoDB connected');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        // Don't throw the error, just let the app run in fallback mode
    }
};

export const getDB = () => mongoose.connection;
