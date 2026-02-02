'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { chatApi } from '@/lib/api';
import { clsx } from 'clsx';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  action?: {
    type: string;
    result: Record<string, unknown>;
  };
}

const quickActions = [
  { text: "How am I doing?", icon: "📊" },
  { text: "I'm feeling stressed", icon: "😰" },
  { text: "Help me sleep better", icon: "😴" },
  { text: "Add a life event", icon: "📅" },
];

export function GlobalWellnessMentor() {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  // Get the user's first name from the employee data
  const firstName = user?.employee?.firstName || 'there';

  // Track component mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize with welcome message when opened
  useEffect(() => {
    if (isOpen && messages.length === 0 && isAuthenticated) {
      const welcomeMessage: Message = {
        id: '1',
        type: 'bot',
        content: `Hi ${firstName}! I'm Shepherd, your wellness mentor. I can help you understand your wellness data, add life events, track how you're feeling, and provide personalized recommendations.\n\nWhat would you like to talk about?`,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, messages.length, firstName, isAuthenticated]);

  const handleSend = useCallback(async (message: string = input) => {
    if (!message.trim() || isTyping) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // Build conversation history
      const conversationHistory = messages.map((m) => ({
        type: m.type,
        content: m.content,
      }));

      // Call the AI chat API
      const response = await chatApi.sendMessage(message, conversationHistory);

      // Only update state if component is still mounted
      if (isMountedRef.current) {
        // Add bot response
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: response.response,
          timestamp: new Date(),
          action: response.action,
        };
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      if (isMountedRef.current) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsTyping(false);
      }
    }
  }, [input, isTyping, messages]);

  const handleQuickAction = useCallback((text: string) => {
    handleSend(text);
  }, [handleSend]);

  // Don't render if not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 z-50 hover:scale-105"
          title="Talk to Shepherd"
        >
          <span className="text-2xl">🐑</span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[550px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                <span className="text-xl">🐑</span>
              </div>
              <div>
                <h3 className="font-semibold text-white">Shepherd</h3>
                <p className="text-xs text-indigo-200">AI Wellness Mentor</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={clsx('flex', message.type === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={clsx(
                    'max-w-[85%] px-4 py-3 rounded-2xl whitespace-pre-wrap text-sm',
                    message.type === 'user'
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-md'
                  )}
                >
                  {message.content}
                  {message.action && (
                    <div className="mt-2 pt-2 border-t border-white/20 text-xs opacity-80">
                      ✓ {message.action.type.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          {messages.length <= 2 && (
            <div className="px-4 pb-2">
              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.text}
                    onClick={() => handleQuickAction(action.text)}
                    disabled={isTyping}
                    className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-gray-700 dark:text-gray-300 hover:text-indigo-700 dark:hover:text-indigo-300 rounded-full transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>{action.icon}</span>
                    <span>{action.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message Shepherd..."
                disabled={isTyping}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 text-sm"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full hover:from-indigo-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
