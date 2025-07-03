// Lab AI generation function for custom prompts and models
async function generateWithGemini(prompt, model = 'gemini-1.5-flash-latest', temperature = 0.7, maxTokens = 100) {
    console.log(`🔄 Making Gemini API call to model: ${model}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 second timeout
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { 
                    temperature: temperature, 
                    maxOutputTokens: maxTokens 
                }
            })
        });
        
        clearTimeout(timeoutId);
        
        console.log(`📊 Gemini API response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API Error Details:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                errorBody: errorText,
                model: model,
                promptLength: prompt.length
            });
            
            // Parse error details if it's JSON
            let errorDetails = 'Unknown error';
            try {
                const errorJson = JSON.parse(errorText);
                errorDetails = errorJson.error?.message || errorJson.message || errorText;
                console.error('📋 Parsed error details:', errorJson);
            } catch (e) {
                errorDetails = errorText;
            }
            
            // Provide specific error messages based on status
            let userFriendlyError;
            switch (response.status) {
                case 400:
                    userFriendlyError = `Invalid request for model ${model}: ${errorDetails}`;
                    break;
                case 401:
                    userFriendlyError = `Authentication failed: Check API key configuration`;
                    break;
                case 403:
                    userFriendlyError = `Access denied: Model ${model} may not be available for your account`;
                    break;
                case 404:
                    userFriendlyError = `Model not found: ${model} is not available`;
                    break;
                case 429:
                    userFriendlyError = `Rate limit exceeded for model ${model}: Try again later`;
                    break;
                case 502:
                case 503:
                    userFriendlyError = `Gemini service unavailable for model ${model}: Try a different model`;
                    break;
                default:
                    userFriendlyError = `Gemini API error ${response.status}: ${errorDetails}`;
            }
            
            throw new Error(userFriendlyError);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (!text) {
            console.error('❌ No content in response:', JSON.stringify(data, null, 2));
            throw new Error('No content generated from AI');
        }

        console.log(`✅ Generated ${text.length} characters successfully`);
        return text.trim();
        
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            console.error('❌ Request timeout after 25 seconds');
            throw new Error(`Request timeout: ${model} took too long to respond (>25s). Try using Gemini Flash for faster responses.`);
        }
        
        console.error('❌ Gemini API error:', error);
        throw error;
    }
}

exports.handler = async (event, context) => {
    console.log('🚀 LAB Function started');
    console.log('📋 Environment check:', {
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        keyPrefix: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 10) + '...' : 'MISSING',
        httpMethod: event.httpMethod,
        timestamp: new Date().toISOString()
    });

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        console.log('❌ Invalid HTTP method:', event.httpMethod);
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('🧪 LAB AI generation request started...');

        // Validate environment variables
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('Missing GEMINI_API_KEY environment variable');
        }

        // Parse request body
        let requestData;
        try {
            requestData = JSON.parse(event.body);
            console.log('📝 Request parsed successfully:', {
                hasPrompt: !!requestData.prompt,
                promptLength: requestData.prompt?.length || 0,
                model: requestData.model,
                temperature: requestData.temperature,
                maxTokens: requestData.maxTokens
            });
        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            throw new Error('Invalid JSON in request body');
        }

        // Extract and validate parameters
        const { 
            prompt, 
            model = 'gemini-2.0-flash',
            temperature = 0.7,
            maxTokens = 100
        } = requestData;

        if (!prompt || prompt.trim().length === 0) {
            throw new Error('Prompt is required');
        }

        // Validate model - latest available models
        const allowedModels = [
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-1.5-flash-8b',
            'gemini-1.5-pro',
            'gemini-2.5-pro-experimental'
        ];
        
        if (!allowedModels.includes(model)) {
            throw new Error(`Invalid model. Allowed models: ${allowedModels.join(', ')}`);
        }

        // Validate temperature
        const tempNum = parseFloat(temperature);
        if (isNaN(tempNum) || tempNum < 0.1 || tempNum > 1.0) {
            throw new Error('Temperature must be between 0.1 and 1.0');
        }

        // Validate maxTokens
        const tokensNum = parseInt(maxTokens);
        if (isNaN(tokensNum) || tokensNum < 10 || tokensNum > 1000) {
            throw new Error('Max tokens must be between 10 and 1000');
        }

        console.log(`🎯 Generating with model: ${model}, temp: ${tempNum}, tokens: ${tokensNum}`);
        console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

        // Generate with Gemini - no fallbacks, let errors bubble up
        const startTime = Date.now();
        const generatedText = await generateWithGemini(prompt, model, tempNum, tokensNum);
        const duration = Date.now() - startTime;
        
        console.log(`⏱️ Generation completed in ${duration}ms`);

        console.log('✅ Generation successful');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                text: generatedText,
                metadata: {
                    model: model,
                    temperature: tempNum,
                    maxTokens: tokensNum,
                    promptLength: prompt.length,
                    responseLength: generatedText.length
                }
            })
        };

    } catch (error) {
        console.error('❌ LAB generation failed:', {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            functionTimeout: context.getRemainingTimeInMillis?.() || 'unknown'
        });
        
        // Determine error category for better user guidance
        let errorCategory = 'unknown';
        let suggestion = 'Try again or contact support';
        
        if (error.message.includes('Authentication failed')) {
            errorCategory = 'authentication';
            suggestion = 'Check API key configuration in environment variables';
        } else if (error.message.includes('not be available')) {
            errorCategory = 'model_unavailable';
            suggestion = 'This model may not be available for your account. Try Gemini 2.0 Flash instead';
        } else if (error.message.includes('Rate limit')) {
            errorCategory = 'rate_limit';
            suggestion = 'Wait a few minutes before trying again, or use a different model';
        } else if (error.message.includes('timeout')) {
            errorCategory = 'timeout';
            suggestion = 'Try using a faster model like Gemini 2.0 Flash';
        } else if (error.message.includes('service unavailable')) {
            errorCategory = 'service_unavailable';
            suggestion = 'Gemini service is temporarily unavailable. Try again in a few minutes';
        }
        
        // Return detailed error information
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                errorType: error.name || 'Unknown',
                errorCategory: errorCategory,
                timestamp: new Date().toISOString(),
                details: {
                    prompt: prompt ? `${prompt.substring(0, 100)}...` : 'No prompt provided',
                    model: model || 'unknown',
                    temperature: tempNum || 'unknown',
                    maxTokens: tokensNum || 'unknown',
                    suggestion: suggestion
                }
            })
        };
    }
};