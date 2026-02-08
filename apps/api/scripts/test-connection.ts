import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from apps/api
dotenv.config({ path: path.join(__dirname, '../.env') });

const uri = process.env.MONGODB_URI;

console.log('Testing MongoDB connection...');
console.log(`URI length: ${uri?.length}`);
// Mask part of URI for safety in logs
console.log(`URI start: ${uri?.substring(0, 20)}...`);

if (!uri) {
    console.error('MONGODB_URI is undefined!');
    process.exit(1);
}

async function testConnection() {
    try {
        await mongoose.connect(uri!, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ Connected successfully!');
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Connection failed!');
        console.error(error);
        process.exit(1);
    }
}

testConnection();
