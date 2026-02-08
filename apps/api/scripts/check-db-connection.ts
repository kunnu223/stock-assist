
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import axios from 'axios';

// Load env from apps/api/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
    console.log('🔍 MongoDB Connection Diagnostic Tool');
    console.log('-------------------------------------');

    // 1. Check Public IP
    try {
        console.log('Checking Public IP...');
        const { data } = await axios.get('https://api.ipify.org?format=json');
        console.log(`🌍 Your Public IP: ${data.ip}`);
        console.log('👉 Please ensure this IP is whitelisted in MongoDB Atlas Network Access.');
    } catch (error: any) {
        console.warn('⚠️ Could not fetch public IP:', error.message);
    }

    console.log('\n');

    // 2. Check Connection
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('❌ MONGODB_URI is missing in .env');
        process.exit(1);
    }

    // Hide password in logs
    const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
    console.log(`Connecting to: ${maskedUri}`);

    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        console.log('✅ Connected to MongoDB successfully!');
        await mongoose.disconnect();
    } catch (error: any) {
        console.error('❌ Connection Failed:', error.message);
        if (error.name === 'MongooseServerSelectionError') {
            console.log('\nPossible causes:');
            console.log('1. IP Address not whitelisted (See Public IP above).');
            console.log('2. Wrong Username/Password.');
            console.log('3. Firewall blocking port 27017.');
        }
    }
}

main();
