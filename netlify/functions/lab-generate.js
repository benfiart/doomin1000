// Lab AI generation function for custom prompts and models
async function generateWithGemini(prompt, model = 'gemini-1.5-flash-latest', temperature = 0.7, maxTokens = 100) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { 
                temperature: temperature, 
                maxOutputTokens: maxTokens 
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
        console.log('🧪 LAB AI generation request...');

        // Validate environment variables
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('Missing GEMINI_API_KEY environment variable');
        }

        // Parse request body
        let requestData;
        try {
            requestData = JSON.parse(event.body);
        } catch (parseError) {
            throw new Error('Invalid JSON in request body');
        }

        // Extract and validate parameters
        const { 
            prompt, 
            model = 'gemini-1.5-flash-latest',
            temperature = 0.7,
            maxTokens = 100
        } = requestData;

        if (!prompt || prompt.trim().length === 0) {
            throw new Error('Prompt is required');
        }

        // Validate model
        const allowedModels = [
            'gemini-1.5-flash-latest',
            'gemini-1.5-pro-latest',
            'gemini-pro'
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
        const generatedText = await generateWithGemini(prompt, model, tempNum, tokensNum);

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
        console.error('❌ LAB generation failed:', error);
        
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
                timestamp: new Date().toISOString(),
                details: {
                    prompt: prompt ? `${prompt.substring(0, 100)}...` : 'No prompt provided',
                    model: model,
                    temperature: tempNum,
                    maxTokens: tokensNum
                }
            })
        };
    }
};