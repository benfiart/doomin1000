class IRCChat {
    constructor() {
        this.messages = [];
        this.messagesContainer = document.getElementById('messages');
        this.nicknameInput = document.getElementById('nickname');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.clearChatButton = document.getElementById('clearChatButton');
        this.changeNicknameButton = document.getElementById('changeNicknameButton');
        this.isOnline = navigator.onLine;
        this.supabaseClient = null;
        
        this.initializeEventListeners();
        this.loadMessagesFromServer();
        this.loadNickname();
        
        // Set up real-time WebSocket subscriptions
        this.setupRealtimeSubscription();
        
        // Check connection status
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncWithServer();
        });
        window.addEventListener('offline', () => {
            this.isOnline = false;
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
        this.messagesContainer.innerHTML = '<div class="status">Welcome to IRC Chat! Enter your nickname and start chatting...</div>';
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

                // Reload from server to show cleared state
                await this.loadMessagesFromServer();

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

    async syncWithServer() {
        // When back online, reload messages from server
        await this.loadMessagesFromServer();
    }

    async setupRealtimeSubscription() {
        try {
            console.log('Setting up real-time subscription...');
            
            // Get Supabase config from server
            console.log('Fetching config from server...');
            const configResponse = await fetch('/.netlify/functions/get-config');
            if (!configResponse.ok) {
                throw new Error(`Config fetch failed: ${configResponse.status}`);
            }
            const config = await configResponse.json();
            console.log('Config received:', { success: config.success, hasUrl: !!config.supabaseUrl, hasKey: !!config.supabaseAnonKey });
            
            if (!config.success) {
                throw new Error('Invalid config response');
            }

            // Import Supabase client directly in the browser
            console.log('Importing Supabase client...');
            const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
            
            // Initialize Supabase client for real-time
            console.log('Creating Supabase client...');
            this.supabaseClient = createClient(
                config.supabaseUrl,
                config.supabaseAnonKey
            );

            // Subscribe to broadcast events on messages channel
            console.log('Setting up broadcast subscription channel...');
            this.subscription = this.supabaseClient
                .channel('messages-channel')
                .on('broadcast', {
                    event: 'INSERT'
                }, (payload) => {
                    console.log('New message received via broadcast:', payload);
                    this.handleNewMessage(payload.payload);
                })
                .on('broadcast', {
                    event: 'DELETE'
                }, (payload) => {
                    console.log('Messages cleared via broadcast:', payload);
                    this.handleMessagesCleared();
                })
                .subscribe((status) => {
                    console.log('Broadcast subscription status:', status);
                });

            console.log('Real-time broadcast subscription set up successfully');
        } catch (error) {
            console.error('Failed to set up real-time subscription:', error);
            // Fallback to polling if real-time fails
            this.startPolling();
        }
    }

    handleNewMessage(newMessage) {
        console.log('Processing new broadcast message:', newMessage);
        
        // Add the new message to our local array
        const message = {
            id: newMessage.id,
            nickname: newMessage.nickname,
            text: newMessage.text,
            color: newMessage.color,
            timestamp: new Date(newMessage.created_at)
        };
        
        console.log('Formatted broadcast message:', message);
        
        // Check if we already have this message (avoid duplicates)
        const exists = this.messages.find(msg => msg.id === message.id);
        if (!exists) {
            console.log('Adding new broadcast message to UI');
            this.messages.push(message);
            this.renderMessage(message);
            this.scrollToBottom();
        } else {
            console.log('Broadcast message already exists, skipping duplicate');
        }
    }

    handleMessagesCleared() {
        // All messages were deleted, clear the UI
        this.messages = [];
        this.messagesContainer.innerHTML = '<div class="status">Chat history cleared.</div>';
    }

    startPolling() {
        // Fallback polling method (only used if WebSocket fails)
        console.log('Falling back to polling method');
        this.pollingInterval = setInterval(async () => {
            if (this.isOnline) {
                try {
                    const response = await fetch('/.netlify/functions/get-messages');
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.messages) {
                            if (data.messages.length !== this.messages.length) {
                                this.messages = data.messages.map(msg => ({
                                    ...msg,
                                    timestamp: new Date(msg.timestamp)
                                }));
                                this.renderAllMessages();
                            }
                        }
                    }
                } catch (error) {
                    console.warn('Polling error:', error);
                }
            }
        }, 3000);
    }

    stopRealtimeSubscription() {
        if (this.subscription) {
            this.supabaseClient.removeChannel(this.subscription);
        }
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
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