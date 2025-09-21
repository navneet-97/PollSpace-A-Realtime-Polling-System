import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, X, Minimize2, Maximize2, Bot, User, Trash2 } from 'lucide-react';
import api from '../utils/api';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const STORAGE_KEY = 'pollspace_chat_history';

  useEffect(() => {
    // Load chat history from localStorage
    const savedMessages = localStorage.getItem(STORAGE_KEY);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed);
      } catch (error) {
        console.error('Error loading chat history:', error);
        initializeChat();
      }
    } else {
      initializeChat();
    }
  }, []);

  useEffect(() => {
    // Save chat history to localStorage whenever messages change
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Chatbot should automatically scroll to show the latest messages when opening
    if (isOpen) {
      inputRef.current?.focus();
      // Scroll to bottom when opening chatbot with smooth behavior
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    // Chatbot should automatically scroll to show the latest messages when expanding from minimized
    if (!isMinimized && isOpen) {
      // Scroll to bottom with smooth behavior when expanding
      setTimeout(() => scrollToBottom(), 100);
    }
  }, [isMinimized, isOpen]);

    const initializeChat = () => {
      const welcomeMessage = {
        id: 'welcome',
        content: "👋 Hi! I'm your PollSpace assistant! Ask me anything about polls, voting, using the platform.",
        isBot: true,
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
      // Scroll to bottom when initializing
      setTimeout(() => scrollToBottom(), 200);
    };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  };

  const scrollToBottomImmediate = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'auto',
        block: 'end'
      });
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      content: inputMessage.trim(),
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    
    // Scroll to bottom immediately when user sends message
    setTimeout(() => scrollToBottomImmediate(), 50);

    try {
      // Always use Gemini API for real-time answers
      const response = await api.post('/chat', {
        message: userMessage.content
      });

      const botMessage = {
        id: (Date.now() + 1).toString(),
        content: response.data.response,
        isBot: true,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
      
      // Scroll to bottom when bot responds
      setTimeout(() => scrollToBottom(), 100);

    } catch (error) {
      console.error('Error getting AI response:', error);
      const fallbackMessage = {
        id: (Date.now() + 1).toString(),
        content: "I'm having trouble connecting to get you a proper answer right now. Please try again in a moment, or check your internet connection.",
        isBot: true,
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, fallbackMessage]);
      
      // Scroll to bottom for error message too
      setTimeout(() => scrollToBottom(), 100);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChatHistory = () => {
    if (window.confirm('Clear all chat history? This cannot be undone.')) {
      localStorage.removeItem(STORAGE_KEY);
      initializeChat();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const quickQuestions = [
    "How do I create a poll?",
    "How do I vote on polls?"
  ];

  const handleQuickQuestion = (question) => {
    setInputMessage(question);
    if (inputRef.current) {
      inputRef.current.focus();
    }
    // Scroll to bottom when quick question is selected
    setTimeout(() => scrollToBottom(), 100);
  };

  const renderChatContent = (isMobile = false) => {
    return (
      <>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">PollSpace Assistant</h3>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'
                }`}></div>
                <p className="text-xs text-gray-600 font-medium">
                  {isLoading ? 'Thinking...' : 'Ready to help'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Show delete button only when chatbot is not minimized */}
            {!isMinimized && messages.length > 1 && (
              <button
                onClick={clearChatHistory}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                title="Clear chat history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            {!isMobile && (
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
                title={isMinimized ? 'Maximize' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200"
              title="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(!isMinimized || isMobile) && (
          <>
            {/* Messages */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white ${
              isMobile ? 'flex-1 min-h-0' : 'h-64'
            }`}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 chat-message ${
                    message.isBot ? 'justify-start' : 'justify-end flex-row-reverse space-x-reverse'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm chat-avatar ${
                    message.isBot 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600'
                      : 'bg-gradient-to-r from-green-500 to-blue-500'
                  }`}>
                    {message.isBot ? (
                      <Bot className="w-4 h-4 text-white" />
                    ) : (
                      <User className="w-4 h-4 text-white" />
                    )}
                  </div>
                  
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl shadow-sm relative chat-bubble ${
                      message.isBot
                        ? message.isError
                          ? 'bg-red-50 text-red-800 border border-red-200'
                          : 'bg-white text-gray-800 border border-gray-200 shadow-md hover:shadow-lg transition-shadow'
                        : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md hover:shadow-lg transition-shadow'
                    }`}
                  >
                    {/* Chat bubble tail */}
                    <div className={`absolute top-3 w-0 h-0 ${
                      message.isBot
                        ? '-left-2 border-r-8 border-white border-t-4 border-b-4 border-t-transparent border-b-transparent'
                        : '-right-2 border-l-8 border-blue-600 border-t-4 border-b-4 border-t-transparent border-b-transparent'
                    }`}></div>
                    
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    <p className={`text-xs mt-2 ${
                      message.isBot ? 'text-gray-500' : 'text-white/80'
                    }`}>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-md relative">
                    <div className="absolute top-3 -left-2 w-0 h-0 border-r-8 border-white border-t-4 border-b-4 border-t-transparent border-b-transparent"></div>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Questions */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 bg-white border-t border-gray-100 flex-shrink-0">
                <p className="text-xs text-gray-600 mb-2 font-medium">
                  💡 Try asking:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {quickQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickQuestion(question)}
                      className="text-xs px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded-lg text-gray-700 hover:text-blue-700 transition-all duration-200 text-left border border-gray-200 hover:border-blue-300 hover:shadow-sm chat-quick-question"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
              <form onSubmit={handleSendMessage} className="flex space-x-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask me anything about PollSpace..."
                  disabled={isLoading}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:opacity-50 disabled:bg-gray-100 transition-all duration-200 chat-input"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="px-3 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-all duration-200 shadow-sm hover:shadow-md chat-send-button flex-shrink-0"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </form>
            </div>
          </>
        )}
      </>
    );
  };

  if (!isOpen) {
    return (
      <>
        {/* Desktop Floating Button */}
        <button
          onClick={() => setIsOpen(true)}
          className="hidden md:flex fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-full shadow-lg items-center justify-center transition-all duration-300 hover:scale-110 z-50 group"
        >
          <MessageCircle className="w-6 h-6 text-white" />
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            Need help with PollSpace?
            <div className="absolute top-full right-4 border-4 border-transparent border-t-gray-900"></div>
          </div>
        </button>
        
        {/* Mobile Floating Button */}
        <button
          onClick={() => setIsOpen(true)}
          className="md:hidden fixed bottom-4 right-4 w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 z-50"
        >
          <MessageCircle className="w-5 h-5 text-white" />
        </button>
      </>
    );
  }

  return (
    <>
      {/* Desktop Chat Window */}
      <div className={`hidden md:block fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        isMinimized ? 'w-80' : 'w-96'
      }`}>
        <div className={`bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col ${
          isMinimized ? 'h-16' : 'h-[480px]'
        } transition-all duration-300`}>
          {renderChatContent()}
        </div>
      </div>
      
      {/* Mobile Chat Modal */}
      <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
        <div className="h-full flex flex-col bg-white">
          {renderChatContent(true)}
        </div>
      </div>
    </>
  );
};
export default Chatbot;
