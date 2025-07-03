// Get latest content (theme, news, etc.) from database
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    // Fallback content (define outside try block for access in catch)
    const fallbacks = {
        theme: "How do you find meaning when everything feels uncertain?",
        news: "Scientists discover new insights about time perception during life transitions.",
        quote: "Every moment brings us closer to understanding our purpose in this grand countdown."
    };

    try {
        console.log('📖 Fetching latest content...');

        // Validate environment variables
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            throw new Error('Missing Supabase environment variables');
        }

        // Initialize Supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        // Get the most recent content from daily_content table
        const { data, error } = await supabase
            .from('daily_content')
            .select('chat_theme, daily_news, main_quote, day_number, created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            throw new Error(`Database query failed: ${error.message}`);
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                theme: data ? data.chat_theme : fallbacks.theme,
                news: data ? data.daily_news : fallbacks.news,
                quote: data ? data.main_quote : fallbacks.quote,
                day_number: data ? data.day_number : 1,
                from_database: !!data
            })
        };

    } catch (error) {
        console.error('❌ Failed to get content:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                theme: fallbacks.theme,
                news: fallbacks.news,
                quote: fallbacks.quote,
                from_database: false
            })
        };
    }
};