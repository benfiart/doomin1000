// Simple theme generator for chat page
const { createClient } = require('@supabase/supabase-js');

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

const FALLBACK_THEMES = [
    "How do you find meaning when everything feels uncertain?",
    "What does genuine human connection look like in a digital world?",
    "How do we build community when traditional structures are changing?",
    "What wisdom can we share to help each other through transition?",
    "How do we balance hope and realism when facing the unknown?"
];

async function generateWithGemini(prompt) {
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

    if (!response.ok) {
        throw new Error(`Gemini API failed: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
        throw new Error('No content generated from AI');
    }

    return text.trim();
}

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('🎯 Generating new chat theme...');

        // Validate environment variables
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!process.env.SUPABASE_URL || !supabaseKey || !process.env.GEMINI_API_KEY) {
            throw new Error('Missing required environment variables');
        }

        // Initialize Supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL,
            supabaseKey
        );

        // Generate a random theme number for variety
        const randomIndex = Math.floor(Math.random() * CHAT_THEMES.length);
        const selectedTheme = CHAT_THEMES[randomIndex];
        const prompt = `Generate a thought-provoking discussion question about ${selectedTheme}. Make it conversational and engaging, designed to spark meaningful chat discussion. 15-30 words. Return only the question.`;

        let generatedTheme;
        try {
            generatedTheme = await generateWithGemini(prompt);
        } catch (error) {
            console.warn('AI generation failed, using fallback:', error);
            generatedTheme = FALLBACK_THEMES[randomIndex % FALLBACK_THEMES.length];
        }

        // Store in database - use existing daily_content table structure
        const timestamp = Date.now();
        const { data, error } = await supabase
            .from('daily_content')
            .insert({
                day_number: timestamp, // Use timestamp as unique day number for now
                date_generated: new Date().toISOString().split('T')[0],
                main_quote: "Generated via button", // Placeholder
                chat_theme: generatedTheme
            })
            .select()
            .single();

        if (error) {
            throw new Error(`Database insert failed: ${error.message}`);
        }

        console.log('✅ Theme generated and stored:', generatedTheme);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                theme: data
            })
        };

    } catch (error) {
        console.error('❌ Theme generation failed:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};