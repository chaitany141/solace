import { useState, useRef, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : 'https://careercampus-lwpa.onrender.com'); 

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => {
    // Generate unique session ID for this page load
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });
  const messagesEndRef = useRef(null);

  // Initialize session storage on component mount
  useEffect(() => {
    // Check if there are stored messages in sessionStorage for this session
    const storedMessages = sessionStorage.getItem(`messages_${sessionId}`);
    
    if (storedMessages) {
      // Load previous messages from this session
      setMessages(JSON.parse(storedMessages));
    } else {
      // First time in this session, show welcome message
      const welcomeMessage = [
        { role: 'ai', content: "Hello! I'm CareerCompass, your personalised career advisor. How can I help you with your professional journey today?" }
      ];
      setMessages(welcomeMessage);
      sessionStorage.setItem(`messages_${sessionId}`, JSON.stringify(welcomeMessage));
    }
  }, [sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to state and sessionStorage
    setMessages(prev => {
      const updated = [...prev, { role: 'user', content: userMessage }];
      sessionStorage.setItem(`messages_${sessionId}`, JSON.stringify(updated));
      return updated;
    });
    
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage, session_id: sessionId }),
      });

      if (!response.ok) {
        let errMsg = 'Network response was not ok';
        try {
          const errorData = await response.json();
          if (errorData && errorData.detail) {
            errMsg = errorData.detail;
          }
        } catch (e) {
          // Response is not JSON
        }
        throw new Error(errMsg);
      }

      const data = await response.json();
      
      // Add AI response to state and sessionStorage
      setMessages(prev => {
        const updated = [...prev, { role: 'ai', content: data.reply }];
        sessionStorage.setItem(`messages_${sessionId}`, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error('Error:', error);
      let errorMessage = "I'm sorry, I'm having trouble connecting to the server right now. Please ensure the backend is running and the API key is set.";
      
      // If we got a specific error from the API (like missing API key), display it
      if (error.message && error.message !== 'Failed to fetch' && error.message !== 'NetworkError when attempting to fetch resource.') {
        errorMessage = `Server Error: ${error.message}`;
      }
      
      // Add error message to state and sessionStorage
      setMessages(prev => {
        const updated = [...prev, { role: 'ai', content: errorMessage }];
        sessionStorage.setItem(`messages_${sessionId}`, JSON.stringify(updated));
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Simple Markdown parser for basic formatting like bold and lists
  const renderMessageContent = (content) => {
    const paragraphs = content.split('\n').filter(p => p.trim());
    return paragraphs.map((p, idx) => {
      let formattedP = p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (p.startsWith('* ') || p.startsWith('- ')) {
        return <li key={idx} dangerouslySetInnerHTML={{__html: formattedP.substring(2)}} />
      }
      return <p key={idx} dangerouslySetInnerHTML={{__html: formattedP}} />
    });
  }

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="header-icon">
          🧭
        </div>
        <div className="header-title">
          <h1>CareerCompass</h1>
          <p>Your Personalised Career Advisor</p>
        </div>
      </header>
      
      <main className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <div className="bubble">
              {renderMessageContent(msg.content)}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message ai">
            <div className="typing">
              <div className="dot"></div>
              <div className="dot"></div>
              <div className="dot"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <form onSubmit={handleSubmit} className="chat-input-area">
        <div className="input-container">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for career advice in any field..."
            className="chat-input"
            disabled={isLoading}
          />
          <button type="submit" className="send-btn" disabled={isLoading || !input.trim()}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </form>

    
    </div>
  )
}

export default App
