// ================================
// DAILY CONTENT GENERATOR
// Generates fresh quote + theme daily at UTC+14 midnight
// ================================

// Import Supabase client
import { createClient } from '@supabase/supabase-js';

// Configuration matching main app
const CONFIG = {
    startDate: new Date('2025-06-11'),
    timezoneOffset: 14, // UTC+14 for earliest timezone
    totalDays: 1000
};

// Quote themes (from app.js)
const QUOTE_THEMES = [
    'time and urgency',
    'human potential and growth', 
    'facing uncertainty',
    'technological progress',
    'collective action',
    'resilience and adaptation',
    'the future we create'
];

// Chat themes (from chat.js)
const CHAT_THEMES = [
    'communication and meaningful connection',
    'shared experiences in uncertain times',
    'collective wisdom and learning from each other',
    'technology\'s impact on human relationships',
    'building community and mutual support',
    'finding purpose and meaning in times of change',
    'collaborative problem solving and hope'
];

// Fallbacks in case AI generation fails
const FALLBACK_QUOTES = [
    "The future is not some place we are going, but one we are creating.",
    "In the face of uncertainty, we find our truest selves.",
    "Change is the only constant. Embrace the transformation.",
    "Every moment brings us closer to who we are meant to become.",
    "What appears as an ending is merely a transition."
];

const FALLBACK_CHAT_THEMES = [
    "How do you find meaning when everything feels uncertain?",
    "What does genuine human connection look like in a digital world?",
    "How do we build community when traditional structures are changing?",
    "What wisdom can we share to help each other through transition?",
    "How do we balance hope and realism when facing the unknown?"
];

// ================================
// UTILITY FUNCTIONS
// ================================

function getCurrentDayNumber() {
    // Use UTC+14 timezone for earliest possible day change
    const now = new Date();
    const utc14Time = new Date(now.getTime() + (14 * 60 * 60 * 1000));
    const startDate = new Date(CONFIG.startDate);
    
    // Calculate days difference from start date
    const timeDiff = utc14Time.getTime() - startDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    const daysPassed = daysDiff >= 0 ? daysDiff + 1 : 0;
    
    return Math.max(1, Math.min(daysPassed, CONFIG.totalDays));
}

async function generateWithGemini(prompt, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { 
                        temperature: 0.7, 
                        maxOutputTokens: 100 
                    }
                })
            });

            if (response.status === 429) {
                // Rate limited - wait and retry
                console.log(`⏳ Rate limited, waiting before retry ${attempt}/${retries}...`);
                await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
                continue;
            }

            if (!response.ok) {
                throw new Error(`Gemini API failed: ${response.status}`);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (!text) {
                throw new Error('No content generated from AI');
            }

            return text.trim();
            
        } catch (error) {
            console.log(`❌ Attempt ${attempt}/${retries} failed:`, error.message);
            
            if (attempt === retries) {
                throw error;
            }
            
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }
    }
}

async function generateMainQuote(dayNumber) {
    const selectedTheme = QUOTE_THEMES[dayNumber % QUOTE_THEMES.length];
    const prompt = `Generate a unique philosophical quote about ${selectedTheme} for day ${dayNumber} of 1000. Make it thought-provoking and distinct, 15-25 words. Focus on ${selectedTheme} specifically. Return only the quote text.`;
    
    try {
        return await generateWithGemini(prompt);
    } catch (error) {
        console.warn('Failed to generate main quote:', error);
        return FALLBACK_QUOTES[dayNumber % FALLBACK_QUOTES.length];
    }
}

async function generateChatTheme(dayNumber) {
    const selectedTheme = CHAT_THEMES[dayNumber % CHAT_THEMES.length];
    const prompt = `Generate a thought-provoking discussion question about ${selectedTheme} for day ${dayNumber} of a 1000-day countdown. Make it conversational and engaging, designed to spark meaningful chat discussion. 15-30 words. Return only the question.`;
    
    try {
        return await generateWithGemini(prompt);
    } catch (error) {
        console.warn('Failed to generate chat theme:', error);
        return FALLBACK_CHAT_THEMES[dayNumber % FALLBACK_CHAT_THEMES.length];
    }
}

// ================================
// MAIN HANDLER
// ================================

export const handler = async (event, context) => {
    try {
        console.log('🌅 Starting daily content generation...');
        
        // Validate environment variables
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            throw new Error('Missing Supabase environment variables');
        }
        
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('Missing Gemini API key');
        }

        // Initialize Supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        // Calculate current day number
        const dayNumber = getCurrentDayNumber();
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        console.log(`📅 Generating content for day ${dayNumber} (${today})`);

        // Check if content already exists for today
        const { data: existingContent } = await supabase
            .from('daily_content')
            .select('*')
            .eq('day_number', dayNumber)
            .single();

        if (existingContent) {
            console.log(`✅ Content already exists for day ${dayNumber}`);
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    success: true,
                    message: `Content already exists for day ${dayNumber}`,
                    dayNumber,
                    content: existingContent
                })
            };
        }

        // Generate fresh content (sequential to avoid rate limits)
        console.log('🤖 Generating fresh content with AI...');
        const mainQuote = await generateMainQuote(dayNumber);
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const chatTheme = await generateChatTheme(dayNumber);

        // Store in database
        const { data, error } = await supabase
            .from('daily_content')
            .insert({
                day_number: dayNumber,
                date_generated: today,
                main_quote: mainQuote,
                chat_theme: chatTheme
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Database insert failed: ${error.message}`);
        }

        console.log('✅ Daily content generated and stored successfully');
        console.log(`📝 Quote: "${mainQuote}"`);
        console.log(`💬 Theme: "${chatTheme}"`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                success: true,
                message: `Generated fresh content for day ${dayNumber}`,
                dayNumber,
                content: data
            })
        };

    } catch (error) {
        console.error('❌ Daily content generation failed:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};