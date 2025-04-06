document.addEventListener('DOMContentLoaded', function() {
    let currentSessionId = null;
    const loadingOverlay = document.getElementById('loading-overlay');
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const chatHistoryList = document.getElementById('chat-history-list');
    const seasonDisplay = document.getElementById('current-season');
    const seasonIcon = document.getElementById('season-icon');
    const suggestionChips = document.querySelectorAll('.suggestion-chip');

    // Set up seasonal theme based on current date
    function setupSeasonalTheme() {
        const date = new Date();
        const month = date.getMonth();
        let season, icon;

        if (month >= 2 && month <= 4) {
            season = "Spring";
            icon = "fa-seedling";
            document.body.classList.add('theme-spring');
        } else if (month >= 5 && month <= 7) {
            season = "Summer";
            icon = "fa-sun";
            document.body.classList.add('theme-summer');
        } else if (month >= 8 && month <= 10) {
            season = "Fall";
            icon = "fa-leaf";
            document.body.classList.add('theme-fall');
        } else {
            season = "Winter";
            icon = "fa-snowflake";
            document.body.classList.add('theme-winter');
        }

        seasonDisplay.textContent = season;
        seasonIcon.className = `fas ${icon}`;
    }

    // Create a new chat session
    async function createNewSession() {
        try {
            showLoading();
            const response = await fetch('/api/session', {
                method: 'POST'
            });
            const data = await response.json();
            currentSessionId = data.sessionId;
            clearChat();
            loadChatHistory();
            hideLoading();
            return currentSessionId;
        } catch (error) {
            console.error('Error creating new session:', error);
            hideLoading();
        }
    }

    // Load all chat sessions for the sidebar
    async function loadChatSessions() {
        try {
            const response = await fetch('/api/sessions');
            const sessions = await response.json();
            
            chatHistoryList.innerHTML = '';
            
            sessions.forEach(session => {
                const historyItem = document.createElement('div');
                historyItem.className = 'chat-history-item';
                historyItem.dataset.sessionId = session.sessionId;
                
                if (currentSessionId === session.sessionId) {
                    historyItem.classList.add('active');
                }
                
                historyItem.innerHTML = `
                    <i class="fas fa-comments"></i>
                    <span>Chat ${new Date(session.timestamp).toLocaleDateString()}</span>
                    <button class="delete-btn" data-session-id="${session.sessionId}">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                
                historyItem.addEventListener('click', (e) => {
                    if (!e.target.closest('.delete-btn')) {
                        loadChatSession(session.sessionId);
                    }
                });
                
                chatHistoryList.appendChild(historyItem);
            });
            
            // Add delete event listeners
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteSession(btn.dataset.sessionId);
                });
            });
            
        } catch (error) {
            console.error('Error loading chat sessions:', error);
        }
    }

    // Load a specific chat session
    async function loadChatSession(sessionId) {
        try {
            showLoading();
            currentSessionId = sessionId;
            
            const response = await fetch(`/api/chat/${sessionId}`);
            const messages = await response.json();
            
            clearChat();
            
            // Mark active session in sidebar
            document.querySelectorAll('.chat-history-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.sessionId === sessionId) {
                    item.classList.add('active');
                }
            });
            
            // Display messages
            messages.forEach(message => {
                addMessageToChat(message.content, message.role === 'user');
            });
            
            hideLoading();
        } catch (error) {
            console.error('Error loading chat:', error);
            hideLoading();
        }
    }

    // Delete a chat session
    async function deleteSession(sessionId) {
        try {
            const response = await fetch(`/api/chat/${sessionId}`, {
                method: 'DELETE'
            });
            
            await response.json();
            
            if (sessionId === currentSessionId) {
                await createNewSession();
            }
            
            loadChatSessions();
        } catch (error) {
            console.error('Error deleting session:', error);
        }
    }

    // Send a message to the AI
    async function sendMessage(message) {
        if (!message.trim()) return;
        
        if (!currentSessionId) {
            await createNewSession();
        }
        
        // Add user message to chat
        addMessageToChat(message, true);
        userInput.value = '';
        
        try {
            showLoading();
            
            const response = await fetch(`/api/chat/${currentSessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Add AI response to chat
            addMessageToChat(data.response, false);
            
            // Refresh chat history list
            loadChatSessions();
            hideLoading();
            
        } catch (error) {
            console.error('Error sending message:', error);
            addMessageToChat('Sorry, I encountered an error. Please try again.', false);
            hideLoading();
        }
    }

    // Add a message to the chat display
    function addMessageToChat(message, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.className = isUser ? 'message user-message' : 'message bot-message';
        
        // Convert markdown-like formatting
        const formattedMessage = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
            .replace(/\n\n/g, '<br><br>') // Paragraphs
            .replace(/\n/g, '<br>'); // Line breaks
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${formattedMessage}</p>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Clear the chat display
    function clearChat() {
        chatMessages.innerHTML = `
            <div class="message bot-message">
                <div class="message-content">
                    <p>Hello! I'm your AI Seasonal Cleaning Assistant. I can help you with cleaning advice, create to-do lists, and develop seasonal cleaning plans for homes or businesses. How can I assist you today?</p>
                </div>
            </div>
        `;
    }

    // Show loading overlay
    function showLoading() {
        loadingOverlay.classList.remove('hidden');
    }

    // Hide loading overlay
    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    // Event listeners
    sendBtn.addEventListener('click', () => {
        sendMessage(userInput.value);
    });

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(userInput.value);
        }
    });

    newChatBtn.addEventListener('click', createNewSession);

    // Suggestion chips
    suggestionChips.forEach(chip => {
        chip.addEventListener('click', () => {
            userInput.value = chip.textContent;
            sendMessage(chip.textContent);
        });
    });

    // Initialize
    setupSeasonalTheme();
    createNewSession().then(() => {
        loadChatSessions();
    });
});