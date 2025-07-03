// LAB page JavaScript for AI experimentation
class AILab {
    constructor() {
        // UI Elements
        this.promptInput = document.getElementById('prompt-input');
        this.themeInput = document.getElementById('theme-input');
        this.dayInput = document.getElementById('day-input');
        this.modelSelect = document.getElementById('model-select');
        this.temperatureInput = document.getElementById('temperature-input');
        this.temperatureValue = document.getElementById('temperature-value');
        this.tokensInput = document.getElementById('tokens-input');
        this.generateBtn = document.getElementById('generate-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.outputTextarea = document.getElementById('output-textarea');
        this.copyBtn = document.getElementById('copy-btn');
        this.useAsPromptBtn = document.getElementById('use-as-prompt-btn');
        this.generationStatus = document.getElementById('generation-status');
        this.characterCount = document.getElementById('character-count');
        this.presetBtns = document.querySelectorAll('.preset-btn');
        this.insertBtns = document.querySelectorAll('.insert-btn');
        this.copyPromptBtn = document.getElementById('copy-prompt-btn');

        // Preset prompts
        this.presets = {
            quote: 'Generate a unique philosophical quote about {theme} for day {dayNumber} of 1000. Make it thought-provoking and distinct, 15-25 words. Focus on {theme} specifically. Return only the quote text.',
            theme: 'Generate a thought-provoking discussion question about {theme}. Make it conversational and engaging, designed to spark meaningful chat discussion. 15-30 words. Return only the question.',
            news: 'Generate a fictional but realistic news headline about breakthrough in understanding {theme}. Make it sound like it could be from a science or technology news outlet. 10-20 words. Be optimistic and forward-looking. Return only the headline.',
            custom: ''
        };

        this.initializeEventListeners();
        this.updateTemperatureDisplay();
        this.updateCharacterCount();
    }

    initializeEventListeners() {
        // Preset buttons
        this.presetBtns.forEach(btn => {
            btn.addEventListener('click', () => this.selectPreset(btn));
        });

        // Insert variable buttons
        this.insertBtns.forEach(btn => {
            btn.addEventListener('click', () => this.insertVariable(btn));
        });

        // Temperature slider
        this.temperatureInput.addEventListener('input', () => this.updateTemperatureDisplay());

        // Generate button
        this.generateBtn.addEventListener('click', () => this.generate());

        // Clear button
        this.clearBtn.addEventListener('click', () => this.clearOutput());

        // Copy button
        this.copyBtn.addEventListener('click', () => this.copyOutput());

        // Use as prompt button
        this.useAsPromptBtn.addEventListener('click', () => this.useAsPrompt());

        // Copy prompt button
        this.copyPromptBtn.addEventListener('click', () => this.copyPrompt());

        // Output textarea for character counting
        this.outputTextarea.addEventListener('input', () => this.updateCharacterCount());

        // Variable inputs for real-time prompt updating
        this.themeInput.addEventListener('input', () => this.updatePromptVariables());
        this.dayInput.addEventListener('input', () => this.updatePromptVariables());
    }

    selectPreset(clickedBtn) {
        // Update active state
        this.presetBtns.forEach(btn => btn.classList.remove('active'));
        clickedBtn.classList.add('active');

        // Get preset type
        const presetType = clickedBtn.dataset.preset;
        
        // Update prompt textarea
        this.promptInput.value = this.presets[presetType];
        
        // Update variables in prompt
        this.updatePromptVariables();

        console.log(`📝 Selected preset: ${presetType}`);
    }

    insertVariable(btn) {
        const variable = btn.dataset.variable;
        const textarea = this.promptInput;
        const cursorPos = textarea.selectionStart;
        
        // Get current text
        const currentText = textarea.value;
        
        // Insert variable at cursor position
        const newText = currentText.slice(0, cursorPos) + variable + currentText.slice(cursorPos);
        
        // Update textarea
        textarea.value = newText;
        
        // Set cursor position after inserted variable
        const newCursorPos = cursorPos + variable.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        
        // Focus back to textarea
        textarea.focus();
        
        console.log(`📝 Inserted variable: ${variable}`);
    }


    updatePromptVariables() {
        const currentPrompt = this.promptInput.value;
        const theme = this.themeInput.value || 'time and urgency';
        const dayNumber = this.dayInput.value || '388';

        // Replace variables in prompt
        const updatedPrompt = currentPrompt
            .replace(/\{theme\}/g, theme)
            .replace(/\{dayNumber\}/g, dayNumber);

        // Only update if different to avoid cursor jumping
        if (currentPrompt !== updatedPrompt && (currentPrompt.includes('{theme}') || currentPrompt.includes('{dayNumber}'))) {
            this.promptInput.value = updatedPrompt;
        }
    }

    updateTemperatureDisplay() {
        this.temperatureValue.textContent = this.temperatureInput.value;
    }

    updateCharacterCount() {
        const count = this.outputTextarea.value.length;
        this.characterCount.textContent = `${count} characters`;
    }

    async generate() {
        // First, ensure variables are substituted before getting the prompt
        this.updatePromptVariables();
        
        const prompt = this.promptInput.value.trim();
        
        if (!prompt) {
            alert('Please enter a prompt');
            this.promptInput.focus();
            return;
        }

        // Disable UI during generation
        this.generateBtn.disabled = true;
        this.generateBtn.textContent = 'Generating...';
        this.generationStatus.textContent = 'Generating...';
        this.outputTextarea.value = '';

        try {
            console.log('🧪 Starting LAB generation...');

            const requestData = {
                prompt: prompt,
                model: this.modelSelect.value,
                temperature: parseFloat(this.temperatureInput.value),
                maxTokens: parseInt(this.tokensInput.value)
            };

            console.log('📤 Request:', requestData);

            const response = await fetch('/.netlify/functions/lab-generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            if (data.success) {
                this.outputTextarea.value = data.text;
                this.generationStatus.textContent = `Generated successfully with ${data.metadata.model}`;
                this.updateCharacterCount();
                
                console.log('✅ Generation successful:', data.metadata);
            } else {
                throw new Error(data.error || 'Generation failed');
            }

        } catch (error) {
            console.error('❌ Generation failed:', error);
            
            let errorMessage = `Error: ${error.message}\n\n`;
            
            // Try to get response data for detailed error info
            try {
                // Check if it's a fetch error with response data
                if (data && !data.success) {
                    errorMessage = this.formatDetailedError(data);
                } else {
                    // Generic error handling
                    errorMessage += `This appears to be a network or function error.\n`;
                    errorMessage += `Try selecting a different model or check your connection.`;
                }
            } catch (parseError) {
                errorMessage += `Network or function error. Try again with a different model.`;
            }
            
            this.outputTextarea.value = errorMessage;
            this.generationStatus.textContent = 'Generation failed - see detailed error below';
            this.updateCharacterCount();
        } finally {
            // Re-enable UI
            this.generateBtn.disabled = false;
            this.generateBtn.textContent = 'Generate';
        }
    }

    clearOutput() {
        this.outputTextarea.value = '';
        this.generationStatus.textContent = 'Ready to generate';
        this.updateCharacterCount();
        console.log('🗑️ Output cleared');
    }

    async copyOutput() {
        const text = this.outputTextarea.value;
        
        if (!text) {
            alert('No output to copy');
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            
            // Visual feedback
            const originalText = this.copyBtn.textContent;
            this.copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                this.copyBtn.textContent = originalText;
            }, 2000);
            
            console.log('📋 Output copied to clipboard');
        } catch (error) {
            console.error('Failed to copy:', error);
            
            // Fallback selection method
            this.outputTextarea.select();
            this.outputTextarea.setSelectionRange(0, 99999);
            
            try {
                document.execCommand('copy');
                this.copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    this.copyBtn.textContent = 'Copy Output';
                }, 2000);
            } catch (fallbackError) {
                alert('Failed to copy to clipboard. Please select and copy manually.');
            }
        }
    }

    useAsPrompt() {
        const text = this.outputTextarea.value;
        
        if (!text) {
            alert('No output to use as prompt');
            return;
        }

        // Clear active preset since we're using custom
        this.presetBtns.forEach(btn => btn.classList.remove('active'));
        this.presetBtns.forEach(btn => {
            if (btn.dataset.preset === 'custom') {
                btn.classList.add('active');
            }
        });

        // Set as new prompt
        this.promptInput.value = text;
        
        // Clear output
        this.clearOutput();
        
        // Focus on prompt for editing
        this.promptInput.focus();
        
        console.log('🔄 Output used as new prompt');
    }

    async copyPrompt() {
        const text = this.promptInput.value;
        
        if (!text) {
            alert('No prompt to copy');
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            
            // Visual feedback
            const originalText = this.copyPromptBtn.textContent;
            this.copyPromptBtn.textContent = 'Copied!';
            setTimeout(() => {
                this.copyPromptBtn.textContent = originalText;
            }, 2000);
            
            console.log('📋 Prompt copied to clipboard');
        } catch (error) {
            console.error('Failed to copy prompt:', error);
            
            // Fallback selection method
            this.promptInput.select();
            this.promptInput.setSelectionRange(0, 99999);
            
            try {
                document.execCommand('copy');
                this.copyPromptBtn.textContent = 'Copied!';
                setTimeout(() => {
                    this.copyPromptBtn.textContent = 'Copy Prompt';
                }, 2000);
            } catch (fallbackError) {
                alert('Failed to copy to clipboard. Please select and copy manually.');
            }
        }
    }

    formatDetailedError(errorData) {
        let message = `❌ ${errorData.error}\n\n`;
        
        if (errorData.errorCategory) {
            message += `Category: ${errorData.errorCategory}\n`;
        }
        
        if (errorData.details) {
            message += `\n📋 Request Details:\n`;
            message += `Model: ${errorData.details.model}\n`;
            message += `Temperature: ${errorData.details.temperature}\n`;
            message += `Max Tokens: ${errorData.details.maxTokens}\n`;
            if (errorData.details.prompt) {
                message += `Prompt: ${errorData.details.prompt}\n`;
            }
        }
        
        if (errorData.details?.suggestion) {
            message += `\n💡 Suggestion: ${errorData.details.suggestion}`;
        }
        
        if (errorData.timestamp) {
            message += `\n\n🕐 Time: ${new Date(errorData.timestamp).toLocaleString()}`;
        }
        
        return message;
    }
}

// Initialize LAB when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the lab page
    if (document.getElementById('prompt-input')) {
        const lab = new AILab();
        console.log('🧪 AI LAB initialized');
    }
});