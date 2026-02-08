
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function listModels() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error('No API key found');
        return;
    }

    /* 
       Note: The GoogleGenerativeAI SDK doesn't have a direct 'listModels' method exposed 
       in all versions, but we can try to test a few known ones to see which returns 200 vs 404.
    */
    const models = [
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro',
        'gemini-1.0-pro',
        'gemini-pro',
        'gemini-flash'
    ];

    console.log('Testing model availability...');
    const genAI = new GoogleGenerativeAI(key);

    for (const modelName of models) {
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            // content generation with empty string might throw validation error, but not 404
            await model.generateContent('Hi');
            console.log(`✅ ${modelName} is AVAILABLE`);
        } catch (error: any) {
            if (error.message.includes('404') || error.message.includes('not found')) {
                console.log(`❌ ${modelName} is NOT FOUND`);
            } else if (error.message.includes('429')) {
                console.log(`⚠️ ${modelName} is RATE LIMITED (but exists)`);
            } else {
                console.log(`✅ ${modelName} EXISTS (Error: ${error.message.split(']')[1] || error.message})`);
            }
        }
    }
}

listModels();
