'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { employeesApi, chatApi } from '@/lib/api';
import type { Zone } from '@/types';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

interface SupportBotProps {
  employeeId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Predefined responses based on zone and topics
const zoneResponses: Record<Zone, Record<string, string[]>> = {
  red: {
    general: [
      "I can see you're going through a challenging time right now. Your recent metrics suggest high stress levels. Let's talk about what's weighing on you most.",
      "Remember, it's okay to not be okay. Based on your data, this might be a good time to focus on recovery rather than pushing through.",
    ],
    sleep: [
      "Your sleep metrics show some room for improvement. Here are some evidence-based tips:\n\n1. **Set a consistent bedtime** - Aim for the same sleep/wake time, even on weekends\n2. **Create a wind-down routine** - No screens 1 hour before bed\n3. **Optimize your environment** - Cool, dark, and quiet\n4. **Limit caffeine after 2pm**",
      "Quality sleep is crucial for recovery. Consider trying a sleep meditation app or progressive muscle relaxation before bed.",
    ],
    stress: [
      "Stress can feel overwhelming, but there are techniques that help:\n\n**Immediate relief:**\n- Box breathing: 4 seconds inhale, 4 hold, 4 exhale, 4 hold\n- Take a 5-minute walk outside\n- Call a friend or family member\n\n**Longer term:**\n- Identify your top 3 stressors and address one\n- Set clear boundaries with work hours",
      "Your HRV suggests elevated stress. Would you like to try a quick guided breathing exercise together?",
    ],
    workload: [
      "I notice your work hours have been higher than usual. Consider:\n\n1. **Prioritize ruthlessly** - What are the top 3 things that truly matter?\n2. **Learn to say no** - or 'not right now'\n3. **Delegate where possible** - You don't have to do everything\n4. **Schedule breaks** - They're productive, not lazy",
      "Talk to your manager about workload distribution. You don't have to carry everything alone.",
    ],
  },
  yellow: {
    general: [
      "You're in a stable zone - not struggling, but not quite at peak either. This is a great time to build healthy habits that will serve you when things get busier.",
      "Your metrics look balanced. Is there anything specific you'd like to work on improving?",
    ],
    sleep: [
      "Your sleep is decent but could be optimized. Small improvements can make a big difference:\n\n- Try going to bed 15 minutes earlier\n- Ensure you're getting enough deep sleep\n- Morning sunlight exposure helps regulate your circadian rhythm",
    ],
    stress: [
      "Your stress levels are manageable. To keep them that way:\n\n- Regular exercise is one of the best stress relievers\n- Maintain social connections\n- Practice gratitude - what went well today?",
    ],
    workload: [
      "Your workload seems balanced. Use this time to:\n\n- Build systems that'll help when things get busy\n- Document processes so tasks are easier to delegate\n- Take on that challenging project you've been wanting to try",
    ],
  },
  green: {
    general: [
      "You're performing at your peak! Your metrics look great across the board. This is the time to take on challenging work and make an impact.",
      "Excellent state! What ambitious goal would you like to work towards?",
    ],
    sleep: [
      "Your sleep metrics are excellent! Keep doing what you're doing:\n\n- Maintain your consistent schedule\n- Your recovery is optimal for handling challenges",
    ],
    stress: [
      "Your stress indicators look healthy. You're well-equipped to handle demanding tasks. Consider:\n\n- Mentoring teammates who might be struggling\n- Taking on stretch assignments\n- This is a great time for creative, complex work",
    ],
    workload: [
      "Your capacity is strong right now. Consider:\n\n- Volunteering for high-visibility projects\n- Learning new skills\n- Helping teammates who are overloaded",
    ],
  },
};

const quickReplies = [
  { text: "I'm feeling stressed", topic: 'stress' },
  { text: "Help me sleep better", topic: 'sleep' },
  { text: "Managing workload", topic: 'workload' },
  { text: "General wellness tips", topic: 'general' },
];

export function SupportBot({ employeeId, isOpen, onClose }: SupportBotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: explanation } = useQuery({
    queryKey: ['explanation', employeeId],
    queryFn: () => employeesApi.getExplanation(employeeId),
  });

  const zone = explanation?.zone || 'yellow';

  // Initialize with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage = getWelcomeMessage(zone);
      setMessages([
        {
          id: '1',
          type: 'bot',
          content: welcomeMessage,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, zone, messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function getWelcomeMessage(zone: Zone): string {
    switch (zone) {
      case 'red':
        return "Hi, I'm Shepherd, your wellness mentor. I can see things have been challenging lately. I'm here to help. What's on your mind?";
      case 'yellow':
        return "Hi, I'm Shepherd, your wellness mentor. Your metrics look stable. Is there anything specific you'd like to work on improving?";
      case 'green':
        return "Hi, I'm Shepherd! You're doing great! I'm here if you want to discuss how to maintain this peak state or tackle new challenges.";
    }
  }

  function generateBotResponse(userMessage: string, zone: Zone): string {
    const lowerMessage = userMessage.toLowerCase();
    let topic: 'stress' | 'sleep' | 'workload' | 'general' = 'general';

    if (lowerMessage.includes('stress') || lowerMessage.includes('anxious') || lowerMessage.includes('overwhelm')) {
      topic = 'stress';
    } else if (lowerMessage.includes('sleep') || lowerMessage.includes('tired') || lowerMessage.includes('exhausted')) {
      topic = 'sleep';
    } else if (lowerMessage.includes('work') || lowerMessage.includes('deadline') || lowerMessage.includes('busy') || lowerMessage.includes('hours')) {
      topic = 'workload';
    }

    const responses = zoneResponses[zone][topic];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  const handleSend = async (message: string = input) => {
    if (!message.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // Show typing indicator
    setIsTyping(true);

    try {
      // Build conversation history for context
      const conversationHistory = messages.map((m) => ({
        type: m.type,
        content: m.content,
      }));

      // Call the AI chat API
      const response = await chatApi.sendMessage(message, conversationHistory);

      // Add bot response
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: response.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
    } catch (error) {
      console.error('Chat error:', error);
      // Fall back to rule-based response on error
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: generateBotResponse(message, zone),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickReply = (reply: typeof quickReplies[0]) => {
    handleSend(reply.text);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[500px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-indigo-600 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white dark:bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-lg">🐑</span>
          </div>
          <div>
            <h3 className="font-semibold text-white">Shepherd</h3>
            <p className="text-xs text-indigo-200">Your wellness mentor</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-indigo-500 rounded-lg p-1 transition-colors"
          aria-label="Close chat"
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
            className={clsx(
              'flex',
              message.type === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={clsx(
                'max-w-[80%] px-4 py-2 rounded-2xl whitespace-pre-wrap',
                message.type === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-md'
              )}
            >
              {message.content}
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

      {/* Quick Replies */}
      {messages.length <= 2 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {quickReplies.map((reply) => (
              <button
                key={reply.topic}
                onClick={() => handleQuickReply(reply)}
                className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-gray-700 dark:text-gray-300 hover:text-indigo-700 dark:hover:text-indigo-300 rounded-full transition-colors"
              >
                {reply.text}
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
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-full focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

// Floating button to open the bot
export function SupportBotButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-40"
      aria-label="Talk to Shepherd"
    >
      <span className="text-2xl">🐑</span>
    </button>
  );
}
