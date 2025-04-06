require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
// Add node-fetch for Node.js v16 compatibility
const fetch = require('node-fetch');
// Make fetch available globally for the Gemini API
global.fetch = fetch;
// Add Headers, Request, and Response to global
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Chat history storage
const CHAT_HISTORY_DIR = path.join(__dirname, 'chat_history');
if (!fs.existsSync(CHAT_HISTORY_DIR)) {
  fs.mkdirSync(CHAT_HISTORY_DIR);
}

// Generate a unique session ID for each chat
function generateSessionId() {
  return Date.now().toString();
}

// Function to save chat history
function saveChatHistory(sessionId, history) {
  const filePath = path.join(CHAT_HISTORY_DIR, `${sessionId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(history));
}

// Function to load chat history
function loadChatHistory(sessionId) {
  const filePath = path.join(CHAT_HISTORY_DIR, `${sessionId}.json`);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return [];
}

// Function to list all chat sessions
function listChatSessions() {
  if (!fs.existsSync(CHAT_HISTORY_DIR)) return [];
  
  return fs.readdirSync(CHAT_HISTORY_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => ({
      sessionId: file.replace('.json', ''),
      timestamp: parseInt(file.replace('.json', '')),
      date: new Date(parseInt(file.replace('.json', ''))).toLocaleString()
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

// Get current season based on date
function getSeason(date) {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return "Spring";
  if (month >= 5 && month <= 7) return "Summer";
  if (month >= 8 && month <= 10) return "Fall";
  return "Winter";
}

// System prompt for the AI
const getSystemPromptText = () => {
  const currentDate = new Date().toLocaleDateString();
  const currentSeason = getSeason(new Date());
  
  return `You are a specialist AI assistant focused exclusively on cleaning and seasonal cleaning advice.

Your capabilities include:
1. Answering cleaning-related questions (methods, products, techniques)
2. Creating cleaning to-do lists for daily, weekly, monthly, and seasonal tasks
3. Making seasonal cleaning planners for homes and businesses
4. Providing customized cleaning schedules

Important rules:
- Only respond to queries related to cleaning and home/business organization
- For non-cleaning questions, politely explain that you can only provide cleaning-related assistance
- Be specific and practical in your advice
- When creating to-do lists, organize items by priority and time requirements
- For seasonal planners, consider the current date (${currentDate}) and provide timely advice

Current season: ${currentSeason}

Always be helpful, positive, and encouraging about cleaning tasks!`;
};

// Route to generate a new session
app.post('/api/session', (req, res) => {
  const sessionId = generateSessionId();
  saveChatHistory(sessionId, []);
  res.json({ sessionId });
});

// Route to list all sessions
app.get('/api/sessions', (req, res) => {
  res.json(listChatSessions());
});

// Route to get chat history
app.get('/api/chat/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  res.json(loadChatHistory(sessionId));
});

// Route to send message to Gemini
app.post('/api/chat/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Load existing history
    let history = loadChatHistory(sessionId);
    
    // Add user message to history
    history.push({ role: 'user', content: message });
    
    // Prepare chat for Gemini
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });
    
    // Get the system prompt
    const systemInstructions = getSystemPromptText();
    
    // Format the prompt correctly for Gemini API - simpler content format for gemini-2.0-flash
    let promptText = systemInstructions + "\n\n";
    
    // Add conversation history context
    history.forEach((entry, index) => {
      // Skip the last user message as we'll add it separately
      if (index === history.length - 1 && entry.role === 'user') return;
      
      if (entry.role === 'user') {
        promptText += "User: " + entry.content + "\n\n";
      } else {
        promptText += "AI: " + entry.content + "\n\n";
      }
    });
    
    // Add the current user query
    promptText += "User: " + message + "\n\nAI: ";
    
    // Generate content with the properly formatted prompt for gemini-2.0-flash
    // Using the simpler format expected by this model
    const result = await model.generateContent(promptText);
    const responseText = result.response.text();
    
    // Add AI response to history
    history.push({ role: 'assistant', content: responseText });
    
    // Save updated history
    saveChatHistory(sessionId, history);
    
    res.json({ response: responseText });
  } catch (error) {
    console.error('Error with Gemini API:', error);
    res.status(500).json({ error: 'Failed to process your request' });
  }
});

// Route for deleting a chat session
app.delete('/api/chat/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const filePath = path.join(CHAT_HISTORY_DIR, `${sessionId}.json`);
  
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Serve main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to use the AI Seasonal Cleaning Planner`);
});