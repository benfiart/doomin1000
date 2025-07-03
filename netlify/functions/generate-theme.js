// Content generator for quotes, themes, and news
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

// No fallback content - display actual errors

const NEWS_TOPICS = [
    'breakthrough in understanding human resilience during uncertainty',
    'innovative approaches to building digital community connections',
    'research on collective decision-making in times of change',
    'discoveries about meaning-making in transitional periods',
    'studies on technology\'s role in fostering genuine relationships',
    'insights into collaborative problem-solving for global challenges',
    'findings on hope and realism in facing unknown futures'
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
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.GEMINI_API_KEY) {
            throw new Error('Missing required environment variables');
        }

        // Initialize Supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        // Parse request body to determine content type
        let contentType = 'theme'; // default
        if (event.body) {
            try {
                const body = JSON.parse(event.body);
                contentType = body.type || 'theme';
            } catch (e) {
                // Use default if parsing fails
            }
        }

        console.log(`🎯 Generating content type: ${contentType}`);

        let generatedContent;
        let contentField;
        
        if (contentType === 'news') {
            const randomIndex = Math.floor(Math.random() * NEWS_TOPICS.length);
            const selectedTopic = NEWS_TOPICS[randomIndex];
            const prompt = `Generate a fictional but realistic news headline about ${selectedTopic}. Make it sound like it could be from a science or technology news outlet. 10-20 words. Be optimistic and forward-looking. Return only the headline.`;
            
            generatedContent = await generateWithGemini(prompt);
            contentField = 'daily_news';
        } else {
            // Original theme generation
            const randomIndex = Math.floor(Math.random() * CHAT_THEMES.length);
            const selectedTheme = CHAT_THEMES[randomIndex];
            const prompt = `Generate a thought-provoking discussion question about ${selectedTheme}. Make it conversational and engaging, designed to spark meaningful chat discussion. 15-30 words. Return only the question.`;
            
            generatedContent = await generateWithGemini(prompt);
            contentField = 'chat_theme';
        }

        // Store in database - use existing daily_content table structure
        // Use a simple incrementing number or current count + 1
        const { count } = await supabase
            .from('daily_content')
            .select('*', { count: 'exact', head: true });
        
        const nextDayNumber = (count || 0) + 1;
        
        // Prepare insert data
        const insertData = {
            day_number: nextDayNumber,
            date_generated: new Date().toISOString().split('T')[0],
            main_quote: "Generated via button" // Placeholder
        };
        
        // Add the generated content to the appropriate field
        insertData[contentField] = generatedContent;
        
        const { data, error } = await supabase
            .from('daily_content')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            throw new Error(`Database insert failed: ${error.message}`);
        }

        console.log(`✅ ${contentType} generated and stored:`, generatedContent);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                content: data,
                type: contentType,
                field: contentField
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