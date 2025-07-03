// ================================
// DAILY CONTENT VERIFICATION
// Check database status and manually trigger generation if needed
// ================================

const { createClient } = require('@supabase/supabase-js');

// Same day calculation logic as generation function
const CONFIG = {
    startDate: new Date('2025-06-11'),
    timezoneOffset: 14, // UTC+14 for earliest timezone
    totalDays: 1000
};

function getCurrentDayNumber() {
    const now = new Date();
    const utc14Time = new Date(now.getTime() + (14 * 60 * 60 * 1000));
    const startDate = new Date(CONFIG.startDate);
    
    const timeDiff = utc14Time.getTime() - startDate.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 3600 * 24));
    const daysPassed = daysDiff >= 0 ? daysDiff + 1 : 0;
    
    return Math.max(1, Math.min(daysPassed, CONFIG.totalDays));
}

exports.handler = async (event, context) => {
    try {
        console.log('🔍 Verifying daily content system...');
        
        // Check environment variables
        const envCheck = {
            supabase_url: !!process.env.SUPABASE_URL,
            supabase_key: !!process.env.SUPABASE_SERVICE_KEY,
            gemini_key: !!process.env.GEMINI_API_KEY
        };

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            throw new Error('Missing Supabase environment variables');
        }

        // Initialize Supabase client
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
        );

        // Get current day info
        const currentDay = getCurrentDayNumber();
        const today = new Date().toISOString().split('T')[0];
        const utc14Time = new Date(Date.now() + (14 * 60 * 60 * 1000));

        console.log(`📅 Current day: ${currentDay} (UTC+14: ${utc14Time.toISOString()})`);

        // Check if content exists for today
        const { data: todayContent, error: todayError } = await supabase
            .from('daily_content')
            .select('*')
            .eq('day_number', currentDay)
            .maybeSingle();

        if (todayError) {
            throw new Error(`Database query failed: ${todayError.message}`);
        }

        // Get recent content (last 5 days)
        const { data: recentContent, error: recentError } = await supabase
            .from('daily_content')
            .select('*')
            .order('day_number', { ascending: false })
            .limit(5);

        if (recentError) {
            throw new Error(`Recent content query failed: ${recentError.message}`);
        }

        // Get total count
        const { count, error: countError } = await supabase
            .from('daily_content')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            throw new Error(`Count query failed: ${countError.message}`);
        }

        // Manual trigger option
        let manualTriggerResult = null;
        if (event.queryStringParameters?.trigger === 'true') {
            console.log('🚀 Manual trigger requested...');
            
            try {
                // Call our generation function
                const generateResponse = await fetch(`${event.headers.origin || 'https://doomin1000.netlify.app'}/.netlify/functions/generate-daily-content`, {
                    method: 'POST'
                });
                
                const generateResult = await generateResponse.json();
                manualTriggerResult = {
                    success: generateResponse.ok,
                    result: generateResult
                };
            } catch (error) {
                manualTriggerResult = {
                    success: false,
                    error: error.message
                };
            }
        }

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                success: true,
                verification: {
                    timestamp: new Date().toISOString(),
                    utc14_time: utc14Time.toISOString(),
                    current_day: currentDay,
                    today_date: today,
                    environment_variables: envCheck,
                    database_connection: true
                },
                today_content: {
                    exists: !!todayContent,
                    data: todayContent
                },
                recent_content: {
                    count: recentContent?.length || 0,
                    entries: recentContent
                },
                total_content_count: count,
                manual_trigger: manualTriggerResult,
                next_scheduled_run: "Daily at 10:00 UTC (00:00 UTC+14)"
            }, null, 2)
        };

    } catch (error) {
        console.error('❌ Verification failed:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            }, null, 2)
        };
    }
};