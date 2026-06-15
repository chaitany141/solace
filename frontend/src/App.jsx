import { useState, useRef, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5173'
    : 'https://solace-pnt3.onrender.com');

function App() {
  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('solace_theme') || 'light';
  });

  // Sessions state
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('solace_sessions');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeSessionId, setActiveSessionId] = useState(null);

  // Current chat messages
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);

  // Apply theme to body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('solace_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Save sessions list whenever it changes
  useEffect(() => {
    localStorage.setItem('solace_sessions', JSON.stringify(sessions));
  }, [sessions]);

  // Load messages when active session changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }

    const storedMessages = localStorage.getItem(`solace_messages_${activeSessionId}`);
    if (storedMessages) {
      setMessages(JSON.parse(storedMessages));
    } else {
      // New session default message
      const welcomeMessage = [
        { role: 'ai', content: "Hello! I'm Solace, your supportive mental wellness companion. How are you feeling today?" }
      ];
      setMessages(welcomeMessage);
      localStorage.setItem(`solace_messages_${activeSessionId}`, JSON.stringify(welcomeMessage));
    }
  }, [activeSessionId]);

  // Save current messages when they change
  useEffect(() => {
    if (activeSessionId && messages.length > 0) {
      localStorage.setItem(`solace_messages_${activeSessionId}`, JSON.stringify(messages));
    }
  }, [messages, activeSessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createNewSession = () => {
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSession = {
      id: newId,
      title: "New Conversation",
      updatedAt: new Date().toISOString()
    };

    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
  };

  // Initialize first session if none exists
  useEffect(() => {
    if (sessions.length === 0 && !activeSessionId) {
      createNewSession();
    } else if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeSessionId) return;

    const userMessage = input.trim();
    setInput('');

    // Update session title if it's the first user message
    if (messages.length <= 1) {
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          // Truncate message for title
          const title = userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage;
          return { ...s, title, updatedAt: new Date().toISOString() };
        }
        return s;
      }));
    } else {
      // Just update the timestamp
      setSessions(prev => {
        const updated = prev.map(s => s.id === activeSessionId ? { ...s, updatedAt: new Date().toISOString() } : s);
        // Bring active to top
        const active = updated.find(s => s.id === activeSessionId);
        const others = updated.filter(s => s.id !== activeSessionId);
        return [active, ...others];
      });
    }

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage, session_id: activeSessionId }),
      });

      if (!response.ok) {
        let errMsg = 'Network response was not ok';
        try {
          const errorData = await response.json();
          if (errorData && errorData.detail) {
            errMsg = errorData.detail;
          }
        } catch (e) { }
        throw new Error(errMsg);
      }

      const data = await response.json();

      setMessages(prev => [...prev, { role: 'ai', content: data.reply }]);
    } catch (error) {
      console.error('Error:', error);
      let errorMessage = "I'm sorry, I'm having trouble connecting right now. Let's take a deep breath and try again later.";

      if (error.message && error.message !== 'Failed to fetch' && error.message !== 'NetworkError when attempting to fetch resource.') {
        errorMessage = `Connection Error: ${error.message}`;
      }

      setMessages(prev => [...prev, { role: 'ai', content: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageContent = (content) => {
    const paragraphs = content.split('\n').filter(p => p.trim());
    return paragraphs.map((p, idx) => {
      let formattedP = p.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      if (p.startsWith('* ') || p.startsWith('- ')) {
        return <li key={idx} dangerouslySetInnerHTML={{ __html: formattedP.substring(2) }} />
      }
      return <p key={idx} dangerouslySetInnerHTML={{ __html: formattedP }} />
    });
  }

  return (
    <div className="app-layout">

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-icon">🌿</div>
          <div className="sidebar-title">
            <h1>Solace</h1>
            <p>A Safe Space for You</p>
          </div>
        </div>

        <button className="new-chat-btn" onClick={createNewSession}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          New Conversation
        </button>

        <div className="sessions-list">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
              onClick={() => setActiveSessionId(session.id)}
            >
              {session.title}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'light' ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                Dark Mode
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                Light Mode
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="main-chat">
        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <h2>Welcome to Solace</h2>
              <p>Take a deep breath. How are you feeling today?</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <div className="bubble">
                  {renderMessageContent(msg.content)}
                </div>
              </div>
            ))
          )}

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
        </div>

        <form onSubmit={handleSubmit} className="chat-input-area">
          <div className="input-container">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Share what's on your mind..."
              className="chat-input"
              disabled={isLoading || !activeSessionId}
            />
            <button type="submit" className="send-btn" disabled={isLoading || !input.trim() || !activeSessionId}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </form>
      </main>

    </div>
  )
}

export default App
