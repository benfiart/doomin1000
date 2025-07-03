// Debug environment variables
exports.handler = async (event, context) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
            environment_check: {
                supabase_url: !!process.env.SUPABASE_URL,
                supabase_service_key: !!process.env.SUPABASE_SERVICE_KEY,
                gemini_api_key: !!process.env.GEMINI_API_KEY,
                supabase_url_partial: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 20) + '...' : 'MISSING',
                all_env_keys: Object.keys(process.env).filter(key => 
                    key.includes('SUPABASE') || key.includes('GEMINI')
                )
            }
        }, null, 2)
    };
};