// ================================
// CHAT THEME SYSTEM
// ================================
const FALLBACK_THEMES = [
    "How do you find meaning when everything feels uncertain?",
    "What does genuine human connection look like in a digital world?",
    "How do we build community when traditional structures are changing?",
    "What wisdom can we share to help each other through transition?",
    "How do we balance hope and realism when facing the unknown?",
    "What role does technology play in bringing us together or apart?",
    "How do we create positive change when time feels limited?"
];

async function generateWithGemini(prompt) {
    const response = await fetch('/.netlify/functions/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
    });
    
    if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    if (data.error) {
        throw new Error(data.error);
    }
    
    if (!data.text) {
        throw new Error('No content generated from AI');
    }
    
    return data.text;
}

async function generateChatTheme(dayNumber) {
    const themes = [
        'communication and meaningful connection',
        'shared experiences in uncertain times',
        'collective wisdom and learning from each other',
        'technology\'s impact on human relationships',
        'building community and mutual support',
        'finding purpose and meaning in times of change',
        'collaborative problem solving and hope'
    ];
    
    const selectedTheme = themes[dayNumber % themes.length];
    const prompt = `Generate a thought-provoking discussion question about ${selectedTheme} for day ${dayNumber} of a 1000-day countdown. Make it conversational and engaging, designed to spark meaningful chat discussion. 15-30 words. Return only the question.`;
    
    try {
        return await generateWithGemini(prompt);
    } catch (error) {
        console.warn('Failed to generate chat theme:', error);
        return FALLBACK_THEMES[dayNumber % FALLBACK_THEMES.length];
    }
}

function getChatThemeStorageKey(day) {
    return `doomsday-chat-theme-${day}`;
}

function saveChatThemeToStorage(data) {
    localStorage.setItem(getChatThemeStorageKey(data.day), JSON.stringify(data));
}

function getChatThemeFromStorage(day) {
    try {
        const stored = localStorage.getItem(getChatThemeStorageKey(day));
        if (!stored) return null;
        
        const data = JSON.parse(stored);
        return data.date === new Date().toDateString() ? data : null;
    } catch (error) {
        console.warn('Failed to load chat theme from storage:', error);
        return null;
    }
}

async function getDailyChatTheme(dayNumber) {
    const cached = getChatThemeFromStorage(dayNumber);
    if (cached) return cached;
    
    try {
        const generated = await generateChatTheme(dayNumber);
        const theme = {
            text: generated,
            day: dayNumber,
            date: new Date().toDateString()
        };
        saveChatThemeToStorage(theme);
        return theme;
    } catch (error) {
        console.warn('Failed to get daily chat theme:', error);
        return {
            text: FALLBACK_THEMES[dayNumber % FALLBACK_THEMES.length],
            day: dayNumber,
            date: new Date().toDateString()
        };
    }
}

// ================================
// CHAT CLASS
// ================================
class IRCChat {
    constructor() {
        this.messages = [];
        this.messagesContainer = document.getElementById('messages');
        this.nicknameInput = document.getElementById('nickname');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.clearChatButton = document.getElementById('clearChatButton');
        this.changeNicknameButton = document.getElementById('changeNicknameButton');
        this.themeTextElement = document.getElementById('chat-theme-text');
        this.themeDayElement = document.getElementById('chat-theme-day');
        this.statusIndicator = document.getElementById('status-indicator');
        this.statusText = document.getElementById('status-text');
        this.generateThemeBtn = document.getElementById('generate-theme-btn');
        this.isOnline = navigator.onLine;
        this.supabaseClient = null;
        
        // WebSocket connection management
        this.connectionState = 'disconnected'; // 'connecting', 'connected', 'disconnected', 'reconnecting'
        this.reconnectAttempts = 0;
        this.maxReconnectDelay = 30000; // 30 seconds max
        this.heartbeatInterval = null;
        this.reconnectTimeout = null;
        
        // Initialize status display
        this.updateConnectionStatus();
        
        this.initializeEventListeners();
        this.loadMessagesFromServer();
        this.loadNickname();
        this.loadThemeFromDatabase();
        
        // Initialize Supabase client once, then set up real-time subscriptions
        this.initializeSupabaseClient();
        
        // Enhanced online/offline handling
        window.addEventListener('online', () => {
            console.log('🌐 Back online - reconnecting...');
            this.isOnline = true;
            this.reconnectAttempts = 0; // Reset attempts when back online
            this.reconnectWebSocket();
        });
        window.addEventListener('offline', () => {
            console.log('📵 Gone offline - stopping connections');
            this.isOnline = false;
            this.connectionState = 'disconnected';
            this.updateConnectionStatus();
            this.stopHeartbeat();
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
            }
        });
    }

    initializeEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        this.nicknameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.messageInput.focus();
            }
        });
        this.clearChatButton.addEventListener('click', () => this.clearChat());
        this.changeNicknameButton.addEventListener('click', () => this.changeNickname());
        this.generateThemeBtn.addEventListener('click', () => this.generateNewTheme());
    }

    async sendMessage() {
        const nickname = this.nicknameInput.value.trim();
        const messageText = this.messageInput.value.trim();

        if (!nickname) {
            alert('Please enter a nickname');
            this.nicknameInput.focus();
            return;
        }

        if (!messageText) {
            alert('Please enter a message');
            this.messageInput.focus();
            return;
        }

        const color = this.generateColor(nickname);
        
        this.saveNickname(nickname);
        this.messageInput.value = '';
        this.messageInput.focus();

        // Try to send to server
        if (this.isOnline) {
            try {
                console.log('Sending message to server:', { nickname, messageText, color });
                const result = await this.sendToServer(nickname, messageText, color);
                console.log('Message sent successfully:', result);
                // Don't reload from server - rely on WebSocket for real-time updates
            } catch (error) {
                console.error('Failed to send message to server:', error);
                alert('Failed to send message. Please try again.');
            }
        } else {
            alert('You are offline. Please check your internet connection.');
        }
    }

    addMessage(message) {
        this.messages.push(message);
        this.renderMessage(message);
        this.scrollToBottom();
    }

    renderMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        const nicknameColor = message.color || this.generateColor(message.nickname);
        messageElement.innerHTML = `
            <span class="timestamp">[${this.formatTime(message.timestamp)}]</span>
            <span class="nickname" style="color: ${nicknameColor}">&lt;${this.escapeHtml(message.nickname)}&gt;</span>
            <span class="text">${this.escapeHtml(message.text)}</span>
        `;
        this.messagesContainer.appendChild(messageElement);
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateConnectionStatus() {
        this.statusIndicator.className = `status-indicator ${this.connectionState}`;
        
        const statusMessages = {
            'connecting': 'Connecting...',
            'connected': 'Connected',
            'disconnected': 'Disconnected',
            'reconnecting': `Reconnecting... (attempt ${this.reconnectAttempts})`
        };
        
        this.statusText.textContent = statusMessages[this.connectionState] || 'Unknown';
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    generateColor(nickname) {
        // Predefined colors that work well on dark backgrounds and are very distinct
        const colors = [
            '#ff6b6b', // bright red
            '#4ecdc4', // teal
            '#45b7d1', // blue
            '#f9ca24', // yellow
            '#6c5ce7', // purple
            '#a55eea', // light purple
            '#26de81', // green
            '#fd79a8', // pink
            '#fdcb6e', // orange
            '#74b9ff', // light blue
            '#e17055', // coral
            '#00b894', // mint
            '#0984e3', // darker blue
            '#e84393', // magenta
            '#00cec9', // cyan
            '#ffeaa7', // light yellow
            '#fab1a0', // peach
            '#81ecec', // light cyan
            '#55a3ff', // sky blue
            '#fd79a8'  // bright pink
        ];
        
        let hash = 0;
        for (let i = 0; i < nickname.length; i++) {
            hash = nickname.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const colorIndex = Math.abs(hash) % colors.length;
        return colors[colorIndex];
    }

    saveMessages() {
        try {
            localStorage.setItem('ircMessages', JSON.stringify(this.messages));
        } catch (e) {
            console.warn('Could not save messages to localStorage');
        }
    }

    async loadMessagesFromServer() {
        if (!this.isOnline) {
            this.loadMessagesFromLocal();
            return;
        }

        try {
            const response = await fetch('/.netlify/functions/get-messages');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.messages) {
                    this.messages = data.messages.map(msg => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp)
                    }));
                    this.renderAllMessages();
                    return;
                }
            }
        } catch (error) {
            console.warn('Failed to load messages from server:', error);
        }
        
        // Fallback to localStorage
        this.loadMessagesFromLocal();
    }

    loadMessagesFromLocal() {
        try {
            const savedMessages = localStorage.getItem('ircMessages');
            if (savedMessages) {
                this.messages = JSON.parse(savedMessages);
                this.messages.forEach(message => {
                    message.timestamp = new Date(message.timestamp);
                });
                this.renderAllMessages();
            }
        } catch (e) {
            console.warn('Could not load messages from localStorage');
        }
    }

    renderAllMessages() {
        this.messagesContainer.innerHTML = '<div class="status">Welcome to DOOM ROOM! Enter your nickname and start chatting...</div>';
        this.messages.forEach(message => {
            this.renderMessage(message);
        });
        this.scrollToBottom();
    }

    saveNickname(nickname) {
        try {
            localStorage.setItem('ircNickname', nickname);
        } catch (e) {
            console.warn('Could not save nickname to localStorage');
        }
    }

    loadNickname() {
        try {
            const savedNickname = localStorage.getItem('ircNickname');
            if (savedNickname) {
                this.nicknameInput.value = savedNickname;
            }
        } catch (e) {
            console.warn('Could not load nickname from localStorage');
        }
    }

    async clearChat() {
        if (confirm('Are you sure you want to clear ALL chat history for EVERYONE? This action cannot be undone and will delete all messages from the database.')) {
            try {
                // Show loading state
                this.messagesContainer.innerHTML = '<div class="status">Clearing chat history...</div>';
                
                // Call API to clear database
                const response = await fetch('/.netlify/functions/clear-messages', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });

                if (!response.ok) {
                    throw new Error(`Server error: ${response.status}`);
                }

                const data = await response.json();
                if (!data.success) {
                    throw new Error(data.error || 'Failed to clear messages');
                }

                // Clear localStorage
                try {
                    localStorage.removeItem('ircMessages');
                } catch (e) {
                    console.warn('Could not clear messages from localStorage');
                }

                console.log('🗑️ Chat cleared successfully');
                // Clear the UI immediately since bulk DELETE might not trigger postgres_changes
                this.handleMessagesCleared();

            } catch (error) {
                console.error('Failed to clear chat:', error);
                this.messagesContainer.innerHTML = '<div class="status" style="color: #ff6666;">Failed to clear chat history. Error: ' + error.message + '</div>';
            }
        }
    }

    changeNickname() {
        try {
            localStorage.removeItem('ircNickname');
            this.nicknameInput.value = '';
            this.nicknameInput.focus();
        } catch (e) {
            console.warn('Could not remove nickname from localStorage');
        }
    }

    async sendToServer(nickname, text, color) {
        const response = await fetch('/.netlify/functions/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nickname: nickname,
                text: text,
                color: color
            })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to send message');
        }

        return data.message;
    }

    async initializeSupabaseClient() {
        try {
            console.log('🔄 Initializing Supabase client...');
            
            // Get Supabase config from server
            const configResponse = await fetch('/.netlify/functions/get-config');
            if (!configResponse.ok) {
                throw new Error(`Config fetch failed: ${configResponse.status}`);
            }
            const config = await configResponse.json();
            
            if (!config.success) {
                throw new Error('Invalid config response');
            }

            // Import Supabase client and create single instance
            const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
            this.supabaseClient = createClient(
                config.supabaseUrl,
                config.supabaseAnonKey
            );
            
            console.log('✅ Supabase client initialized');
            
            // Now set up real-time subscription using existing client
            this.setupRealtimeSubscription();
            
        } catch (error) {
            console.error('Failed to initialize Supabase client:', error);
            this.connectionState = 'disconnected';
            this.updateConnectionStatus();
            // Try to reconnect
            this.reconnectWebSocket();
        }
    }

    async syncWithServer() {
        // Force fresh data fetch with cache-busting
        console.log('🔄 Syncing with server - fetching fresh data...');
        try {
            const timestamp = Date.now();
            const response = await fetch(`/.netlify/functions/get-messages?t=${timestamp}`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.messages) {
                    console.log(`📥 Fresh sync: loaded ${data.messages.length} messages`);
                    this.messages = data.messages.map(msg => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp)
                    }));
                    this.renderAllMessages();
                }
            }
        } catch (error) {
            console.error('Failed to sync with server:', error);
        }
    }

    getReconnectDelay() {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
        return delay;
    }

    async reconnectWebSocket() {
        if (!this.isOnline) {
            console.log('⏸️ Not attempting reconnect while offline');
            return;
        }

        if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
            console.log('⏸️ Already connected or connecting');
            return;
        }

        this.connectionState = 'reconnecting';
        this.reconnectAttempts++;
        this.updateConnectionStatus();
        const delay = this.getReconnectDelay();
        
        console.log(`🔄 Attempting WebSocket reconnect #${this.reconnectAttempts} in ${delay}ms...`);
        
        this.reconnectTimeout = setTimeout(async () => {
            try {
                // If client doesn't exist, reinitialize everything
                if (!this.supabaseClient) {
                    await this.initializeSupabaseClient();
                } else {
                    // Client exists, just reconnect subscription
                    await this.setupRealtimeSubscription();
                }
                
                // If successful, sync fresh data and reset attempts
                if (this.connectionState === 'connected') {
                    await this.syncWithServer();
                    this.reconnectAttempts = 0;
                    console.log('✅ WebSocket reconnected successfully');
                }
            } catch (error) {
                console.error(`❌ Reconnect attempt #${this.reconnectAttempts} failed:`, error);
                // Try again with longer delay
                this.reconnectWebSocket();
            }
        }, delay);
    }

    async setupRealtimeSubscription() {
        try {
            // Clean up existing subscription (but keep client)
            this.cleanupSubscription();
            
            // Skip if client not initialized yet
            if (!this.supabaseClient) {
                console.log('⏸️ Supabase client not ready, skipping subscription setup');
                return;
            }
            
            this.connectionState = 'connecting';
            this.updateConnectionStatus();
            console.log('🔄 Setting up real-time subscription...');

            // Subscribe to postgres changes with enhanced error handling
            this.subscription = this.supabaseClient
                .channel('schema-db-changes')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'messages'
                }, (payload) => {
                    if (payload.eventType === 'INSERT') {
                        this.handleNewMessage(payload.new);
                    } else if (payload.eventType === 'DELETE') {
                        console.log('🗑️ Messages cleared via postgres changes');
                        if (this.messages.length > 0) {
                            this.handleMessagesCleared();
                        }
                    }
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        this.connectionState = 'connected';
                        this.reconnectAttempts = 0; // Reset on successful connection
                        this.updateConnectionStatus();
                        console.log('✅ WebSocket connected successfully');
                        this.startHeartbeat();
                    } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
                        console.error(`❌ WebSocket error: ${status}`);
                        this.connectionState = 'disconnected';
                        this.updateConnectionStatus();
                        this.stopHeartbeat();
                        // Attempt to reconnect
                        this.reconnectWebSocket();
                    }
                });
        } catch (error) {
            console.error('Failed to set up real-time subscription:', error);
            this.connectionState = 'disconnected';
            this.updateConnectionStatus();
            // Attempt to reconnect
            this.reconnectWebSocket();
        }
    }

    startHeartbeat() {
        // Clear any existing heartbeat
        this.stopHeartbeat();
        
        // Send heartbeat every 30 seconds to detect silent disconnections
        this.heartbeatInterval = setInterval(() => {
            if (this.connectionState === 'connected' && this.supabaseClient) {
                // Simple presence update to test connection
                this.supabaseClient
                    .channel('heartbeat')
                    .subscribe((status) => {
                        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
                            console.log('💔 Heartbeat failed - connection lost');
                            this.connectionState = 'disconnected';
                            this.updateConnectionStatus();
                            this.stopHeartbeat();
                            this.reconnectWebSocket();
                        }
                    });
            }
        }, 30000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    cleanupSubscription() {
        // Clean up subscription without destroying the client
        this.stopHeartbeat();
        
        if (this.subscription) {
            this.supabaseClient?.removeChannel(this.subscription);
            this.subscription = null;
        }
        
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    handleNewMessage(newMessage) {
        // Add the new message to our local array
        const message = {
            id: newMessage.id,
            nickname: newMessage.nickname,
            text: newMessage.text,
            color: newMessage.color,
            timestamp: new Date(newMessage.created_at)
        };
        
        // Check if we already have this message (avoid duplicates)
        const exists = this.messages.find(msg => msg.id === message.id);
        if (!exists) {
            console.log('📨 New message received via postgres changes:', message.nickname, '-', message.text);
            this.messages.push(message);
            this.renderMessage(message);
            this.scrollToBottom();
        }
    }

    handleMessagesCleared() {
        // All messages were deleted, clear the UI
        console.log('🗑️ All messages cleared via postgres changes');
        this.messages = [];
        this.messagesContainer.innerHTML = '<div class="status">Chat history cleared for everyone! 🗑️</div>';
    }


    stopRealtimeSubscription() {
        // Clean up subscriptions and timers
        this.cleanupSubscription();
        
        this.connectionState = 'disconnected';
        this.updateConnectionStatus();
    }

    // ================================
    // THEME MANAGEMENT
    // ================================
    getCurrentDayNumber() {
        // Use same logic as main page app.js
        const CONFIG = {
            startDate: new Date('2025-06-11'),
            timezoneOffset: -(new Date().getTimezoneOffset() / 60)
        };
        const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
        
        function toConfiguredTimezone(date) {
            const newDate = new Date(date);
            const year = newDate.getUTCFullYear();
            const month = newDate.getUTCMonth();
            const day = newDate.getUTCDate();
            const hours = newDate.getUTCHours();
            const minutes = newDate.getUTCMinutes();
            const seconds = newDate.getUTCSeconds();
            const milliseconds = newDate.getUTCMilliseconds();
            const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));
            utcDate.setUTCHours(utcDate.getUTCHours() + CONFIG.timezoneOffset);
            return utcDate;
        }
        
        function getMidnightInTimezone(date) {
            const timezoneDate = toConfiguredTimezone(date);
            const year = timezoneDate.getUTCFullYear();
            const month = timezoneDate.getUTCMonth();
            const day = timezoneDate.getUTCDate();
            return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
        }
        
        const now = new Date();
        const startMidnight = getMidnightInTimezone(CONFIG.startDate);
        const nowMidnight = getMidnightInTimezone(now);
        const daysDifference = Math.floor((nowMidnight.getTime() - startMidnight.getTime()) / MILLISECONDS_PER_DAY);
        const daysPassed = daysDifference >= 0 ? daysDifference + 1 : 0;
        
        return Math.max(1, daysPassed);
    }

    async loadThemeFromDatabase() {
        try {
            console.log('📖 Loading theme from database...');
            const response = await fetch('/.netlify/functions/get-theme');
            const data = await response.json();
            
            if (data.success) {
                this.themeTextElement.textContent = data.theme;
                this.themeDayElement.textContent = data.from_database ? `From Database` : `Fallback`;
                console.log('✅ Theme loaded:', data.theme);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Failed to load theme from database:', error);
            this.themeTextElement.textContent = "How do you find meaning when everything feels uncertain?";
            this.themeDayElement.textContent = "Fallback";
        }
    }

    async generateNewTheme() {
        try {
            this.generateThemeBtn.disabled = true;
            this.generateThemeBtn.textContent = 'Generating...';
            
            console.log('🎯 Generating new theme...');
            const response = await fetch('/.netlify/functions/generate-theme', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.themeTextElement.textContent = data.theme.chat_theme;
                this.themeDayElement.textContent = 'Just Generated';
                console.log('✅ New theme generated:', data.theme.chat_theme);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Failed to generate new theme:', error);
            alert('Failed to generate new theme. Please try again.');
        } finally {
            this.generateThemeBtn.disabled = false;
            this.generateThemeBtn.textContent = 'Generate New Theme';
        }
    }
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if we're on the chat page
    if (document.getElementById('messages')) {
        const chat = new IRCChat();
        
        // Clean up real-time subscription when page is unloaded
        window.addEventListener('beforeunload', () => {
            chat.stopRealtimeSubscription();
        });
    }
});