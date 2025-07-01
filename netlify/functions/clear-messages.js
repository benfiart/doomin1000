const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Only allow DELETE requests
  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS'
      },
      body: ''
    };
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // First, get all messages to see what we're working with
    const { data: allMessages, error: fetchError } = await supabase
      .from('messages')
      .select('id');

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      throw fetchError;
    }

    console.log('Messages to delete:', allMessages?.length || 0);

    // Delete all messages from the database
    const { data, error } = await supabase
      .from('messages')
      .delete()
      .gte('id', 0); // Delete all rows where id >= 0 (all messages)

    if (error) {
      console.error('Delete error:', error);
      throw error;
    }

    console.log('Delete operation completed, affected rows:', data?.length || 0);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: `Cleared ${allMessages?.length || 0} messages from database`,
        deletedCount: data?.length || 0
      })
    };

  } catch (error) {
    console.error('Clear messages error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};