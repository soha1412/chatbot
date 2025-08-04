document.addEventListener('DOMContentLoaded', function () {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const themeToggle = document.getElementById('theme-toggle');
    const fileInput = document.getElementById('file-input');
    const useDocContextToggle = document.getElementById('useDocContext');

    const API_URL = 'https://chatbot-1-gqkp.onrender.com';
    const sendSound = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-arrow-whoosh-1491.mp3');
    sendSound.volume = 0.3;

    const welcomeMessages = [
        "Blinggg! 🌟 I'm Sova, your wise AI assistant. Ask me anything!",
        "Perched and ready—how can I help you today?",
        "Greetings! I'm Sova, here to assist you. What's on your mind?"
    ];

    
    setTimeout(() => {
        addMessage(welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)], false);
    }, 500);

   
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = getMoonIcon();
    }

    themeToggle.addEventListener('click', function () {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeToggle.innerHTML = isDark ? getMoonIcon() : getSunIcon();
    });

    function getMoonIcon() {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    }

    function getSunIcon() {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    }

    function addMessage(text, isUser) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', isUser ? 'user-message' : 'bot-message');

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        messageDiv.innerHTML = `${text}<div class="timestamp">${timestamp}</div>`;

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function showTyping() {
        const typingDiv = document.createElement('div');
        typingDiv.classList.add('typing-indicator');
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function hideTyping() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) typingIndicator.remove();
    }

    async function sendMessageToServer(message) {
        try {
            const useDocContext = useDocContextToggle.checked;
            
            const response = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message: message,
                    use_document_context: useDocContext
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Request failed');
            }

            return await response.json();
        } catch (error) {
            console.error('Error:', error);
            return { response: "Sorry, I'm having trouble connecting. Please try again later." };
        }
    }

    async function handleUserInput() {
        const text = userInput.value.trim();
        if (text === '') return;

        addMessage(text, true);
        userInput.value = '';
        sendSound.play().catch(() => {});

        showTyping();

        try {
            const response = await sendMessageToServer(text);
            hideTyping();
            addMessage(response.response, false);
        } catch (error) {
            hideTyping();
            addMessage("Sorry, I'm having trouble responding right now.", false);
        }
    }

    async function uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('File upload failed');
            }

            const data = await response.json();
            return data.response || "File uploaded successfully!";
        } catch (error) {
            console.error('Error uploading file:', error);
            return "Sorry, I couldn't process your file. Please try again.";
        }
    }

    async function handleFileUpload(file) {
        addMessage(`Uploading ${file.name}...`, true);
        showTyping();

        try {
            const reply = await uploadFile(file);
            hideTyping();
            addMessage(reply, false);
        } catch (error) {
            hideTyping();
            addMessage("Failed to upload file. Please try again.", false);
        }
    }

    
    sendButton.addEventListener('click', handleUserInput);
    userInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') handleUserInput();
    });

    fileInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
            handleFileUpload(this.files[0]);
            this.value = ''; 
        }
    });
});