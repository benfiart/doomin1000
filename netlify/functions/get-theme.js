// Get latest chat theme from database
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    try {
        console.log('📖 Fetching latest chat theme...');

        // Validate environment variables
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!process.env.SUPABASE_URL || !supabaseKey) {
            throw new Error('Missing Supabase environment variables');
        }

        // Initialize Supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL,
            supabaseKey
        );

        // Get the most recent theme from daily_content table
        const { data, error } = await supabase
            .from('daily_content')
            .select('chat_theme, day_number, created_at')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            throw new Error(`Database query failed: ${error.message}`);
        }

        // If no theme exists, return fallback
        const fallbackTheme = "How do you find meaning when everything feels uncertain?";
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                theme: data ? data.chat_theme : fallbackTheme,
                day_number: data ? data.day_number : 1,
                from_database: !!data
            })
        };

    } catch (error) {
        console.error('❌ Failed to get theme:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                theme: "How do you find meaning when everything feels uncertain?", // Fallback
                from_database: false
            })
        };
    }
};