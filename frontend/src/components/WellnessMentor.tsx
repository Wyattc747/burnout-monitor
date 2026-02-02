'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { MessageCircle, Send, Phone, X, Smartphone, ChevronRight, Calendar, TrendingUp, Heart, Plus } from 'lucide-react';
import { chatApi } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface Message {
  id: string;
  type: 'user' | 'mentor';
  text: string;
  timestamp: Date;
  action?: {
    type: 'life_event' | 'checkin' | 'data_request' | 'recommendation';
    data?: any;
  };
}

// Demo conversation for the iPhone mockup
const DEMO_CONVERSATION: Message[] = [
  {
    id: '1',
    type: 'mentor',
    text: "Good morning! I noticed your sleep has been shorter than usual this week. How are you feeling today?",
    timestamp: new Date(Date.now() - 3600000 * 2),
  },
  {
    id: '2',
    type: 'user',
    text: "Pretty tired honestly. Been stressed about a big project deadline.",
    timestamp: new Date(Date.now() - 3600000 * 1.5),
  },
  {
    id: '3',
    type: 'mentor',
    text: "I understand. Work deadlines can be stressful. Would you like me to log this as a work stress event? It helps me give you better recommendations.",
    timestamp: new Date(Date.now() - 3600000 * 1.4),
  },
  {
    id: '4',
    type: 'user',
    text: "Yes please",
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: '5',
    type: 'mentor',
    text: "Done! I've added 'Project Deadline Stress' to your life events. Based on your current wellness score of 62%, I recommend taking short breaks every 90 minutes today. Would you like me to set reminders?",
    timestamp: new Date(Date.now() - 3600000 * 0.9),
    action: { type: 'life_event', data: { eventType: 'work_stress', label: 'Project Deadline Stress' } },
  },
  {
    id: '6',
    type: 'user',
    text: "What's my wellness score breakdown?",
    timestamp: new Date(Date.now() - 1800000),
  },
  {
    id: '7',
    type: 'mentor',
    text: "Here's your breakdown:\n\n Sleep: 6.2 hrs (below your 7.5hr baseline)\n HRV: 38ms (elevated stress)\n Activity: 4,200 steps (below goal)\n Work Hours: 9.5 hrs yesterday\n\nYour main factors are sleep and HRV. Improving sleep tonight could boost your score by 10-15 points.",
    timestamp: new Date(Date.now() - 1700000),
    action: { type: 'data_request', data: { metric: 'breakdown' } },
  },
  {
    id: '8',
    type: 'user',
    text: "Add a life event - started new medication",
    timestamp: new Date(Date.now() - 600000),
  },
  {
    id: '9',
    type: 'mentor',
    text: "Got it! I've added 'New Medication' to your life events starting today. This helps me understand changes in your metrics. Is this a temporary or ongoing medication?",
    timestamp: new Date(Date.now() - 500000),
    action: { type: 'life_event', data: { eventType: 'health_change', label: 'New Medication' } },
  },
];

// Quick action suggestions
const QUICK_ACTIONS = [
  { label: 'Check my score', icon: TrendingUp },
  { label: 'Add life event', icon: Plus },
  { label: 'How am I doing?', icon: Heart },
  { label: 'Log feeling', icon: MessageCircle },
];

// Preview card for dashboard
export function WellnessMentorPreview() {
  const [showFullDemo, setShowFullDemo] = useState(false);

  return (
    <>
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              Wellness Mentor
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Chat with your AI wellness coach via SMS
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
              Active
            </span>
          </div>
        </div>

        {/* Recent Messages Preview */}
        <div className="space-y-3 mb-4">
          {DEMO_CONVERSATION.slice(-2).map((msg) => (
            <div
              key={msg.id}
              className={clsx(
                'p-3 rounded-lg text-sm',
                msg.type === 'mentor'
                  ? 'bg-green-50 dark:bg-green-900/20 text-gray-700 dark:text-gray-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 ml-8'
              )}
            >
              <p className="line-clamp-2">{msg.text}</p>
              <p className="text-xs text-gray-400 mt-1">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_ACTIONS.slice(0, 2).map((action) => (
            <button
              key={action.label}
              className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-xs text-gray-700 dark:text-gray-300 transition-colors"
            >
              <action.icon className="w-3 h-3" />
              {action.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowFullDemo(true)}
          className="w-full btn btn-secondary flex items-center justify-center gap-2"
        >
          <Smartphone className="w-4 h-4" />
          View Demo Conversation
          <ChevronRight className="w-4 h-4" />
        </button>

        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-3">
          Text your mentor anytime at (555) 123-WELL
        </p>
      </div>

      {/* Full Demo Modal */}
      {showFullDemo && (
        <WellnessMentorDemo onClose={() => setShowFullDemo(false)} />
      )}
    </>
  );
}

// Life event types for SMS
const SMS_LIFE_EVENT_TYPES: Record<string, { type: string; label: string; impact: 'low' | 'medium' | 'high' }> = {
  'new job': { type: 'new_job', label: 'Started New Job', impact: 'high' },
  'promotion': { type: 'promotion', label: 'Got Promoted', impact: 'medium' },
  'vacation': { type: 'vacation', label: 'On Vacation', impact: 'low' },
  'travel': { type: 'vacation', label: 'Traveling', impact: 'low' },
  'moving': { type: 'moving', label: 'Moving/Relocated', impact: 'high' },
  'relocation': { type: 'moving', label: 'Relocating', impact: 'high' },
  'baby': { type: 'new_baby', label: 'New Baby', impact: 'high' },
  'wedding': { type: 'wedding', label: 'Getting Married', impact: 'high' },
  'married': { type: 'wedding', label: 'Getting Married', impact: 'high' },
  'health': { type: 'health_issue', label: 'Health Issue', impact: 'high' },
  'medication': { type: 'health_issue', label: 'New Medication', impact: 'medium' },
  'sick': { type: 'health_issue', label: 'Health Issue', impact: 'medium' },
  'family': { type: 'family_issue', label: 'Family Matter', impact: 'medium' },
  'classes': { type: 'education', label: 'Taking Classes', impact: 'medium' },
  'school': { type: 'education', label: 'Back to School', impact: 'medium' },
  'stress': { type: 'other', label: 'Stressful Period', impact: 'high' },
  'deadline': { type: 'other', label: 'Project Deadline', impact: 'medium' },
  'project': { type: 'other', label: 'Big Project', impact: 'medium' },
};

// iPhone mockup demo
export function WellnessMentorDemo({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>(DEMO_CONVERSATION);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const queryClient = useQueryClient();

  // Track component mount state for cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Function to add a life event via API
  const addLifeEvent = async (eventType: string, eventLabel: string, impactLevel: 'low' | 'medium' | 'high') => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/personalization/life-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventType,
          eventLabel,
          startDate: new Date().toISOString().split('T')[0],
          impactLevel,
        }),
      });
      if (res.ok) {
        // Invalidate queries to refresh dashboard
        queryClient.invalidateQueries({ queryKey: ['personalization'] });
        return true;
      }
    } catch (err) {
      console.error('Failed to add life event:', err);
    }
    return false;
  };

  // Detect life event from message - more flexible detection
  const detectLifeEvent = (message: string): { type: string; label: string; impact: 'low' | 'medium' | 'high' } | null => {
    const lowerMessage = message.toLowerCase();

    // Check each keyword
    for (const [keyword, eventInfo] of Object.entries(SMS_LIFE_EVENT_TYPES)) {
      if (lowerMessage.includes(keyword)) {
        return eventInfo;
      }
    }

    // Additional pattern matching for common phrases
    if (lowerMessage.includes('got promoted') || lowerMessage.includes('new role')) {
      return SMS_LIFE_EVENT_TYPES['promotion'];
    }
    if (lowerMessage.includes('feeling sick') || lowerMessage.includes('not feeling well')) {
      return SMS_LIFE_EVENT_TYPES['sick'];
    }
    if (lowerMessage.includes('taking time off') || lowerMessage.includes('going on') && lowerMessage.includes('trip')) {
      return SMS_LIFE_EVENT_TYPES['vacation'];
    }

    return null;
  };

  // Check if message is requesting to add an event
  const isLifeEventRequest = (message: string): boolean => {
    const lowerMessage = message.toLowerCase();
    return (
      lowerMessage.includes('add') ||
      lowerMessage.includes('log') ||
      lowerMessage.includes('record') ||
      lowerMessage.includes('started') ||
      lowerMessage.includes('beginning') ||
      lowerMessage.includes('i have') ||
      lowerMessage.includes("i'm") ||
      lowerMessage.includes('new ')
    );
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      text: inputText,
      timestamp: new Date(),
    };

    const currentInput = inputText;
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      // Build conversation history for ChatGPT context
      const conversationHistory = messages.map((m) => ({
        type: m.type === 'mentor' ? 'bot' : 'user',
        content: m.text,
      }));

      // Call the ChatGPT-powered chat API
      const response = await chatApi.sendMessage(currentInput, conversationHistory);

      // Only update state if component is still mounted
      if (!isMountedRef.current) return;

      const mentorResponse: Message = {
        id: Date.now().toString(),
        type: 'mentor',
        text: response.response,
        timestamp: new Date(),
        action: response.action ? {
          type: response.action.type as 'life_event' | 'checkin' | 'data_request' | 'recommendation',
          data: response.action.result,
        } : undefined,
      };

      // Invalidate queries if an action was taken
      if (response.action) {
        queryClient.invalidateQueries({ queryKey: ['personalization'] });
        queryClient.invalidateQueries({ queryKey: ['employee'] });
      }

      setMessages((prev) => [...prev, mentorResponse]);
    } catch (error) {
      console.error('Chat error:', error);
      // Only update state if component is still mounted
      if (!isMountedRef.current) return;
      // Fallback to local response if API fails
      const fallbackResponse: Message = {
        id: Date.now().toString(),
        type: 'mentor',
        text: "I'm having trouble connecting right now. Please try again in a moment, or check your internet connection.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackResponse]);
    } finally {
      if (isMountedRef.current) {
        setIsTyping(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* iPhone Frame */}
      <div className="relative w-full max-w-[375px]">
        <div className="bg-black rounded-[3rem] p-3 shadow-2xl">
          {/* Notch */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-full z-10" />

          {/* Screen */}
          <div className="bg-gray-100 dark:bg-gray-900 rounded-[2.5rem] overflow-hidden h-[600px] flex flex-col">
            {/* Status Bar */}
            <div className="flex items-center justify-between px-8 py-2 bg-white dark:bg-gray-800">
              <span className="text-sm font-semibold">9:41</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 flex items-end gap-0.5">
                  <div className="w-1 h-1 bg-gray-800 dark:bg-white rounded-full" />
                  <div className="w-1 h-2 bg-gray-800 dark:bg-white rounded-full" />
                  <div className="w-1 h-3 bg-gray-800 dark:bg-white rounded-full" />
                  <div className="w-1 h-4 bg-gray-800 dark:bg-white rounded-full" />
                </div>
                <span className="text-sm">100%</span>
              </div>
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <button onClick={onClose} className="text-blue-500 text-sm">
                Close
              </button>
              <div className="flex-1 text-center">
                <p className="font-semibold text-gray-900 dark:text-white">ShepHerd</p>
                <p className="text-xs text-green-500">Wellness Mentor</p>
              </div>
              <Phone className="w-5 h-5 text-blue-500" />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={clsx(
                    'max-w-[80%]',
                    msg.type === 'user' ? 'ml-auto' : ''
                  )}
                >
                  <div
                    className={clsx(
                      'p-3 rounded-2xl',
                      msg.type === 'mentor'
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-tl-sm'
                        : 'bg-blue-500 text-white rounded-tr-sm'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  </div>
                  {msg.action && (
                    <div className="mt-1 ml-2">
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-full',
                        msg.action.type === 'life_event' ? 'bg-purple-100 text-purple-700' :
                        msg.action.type === 'data_request' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                      )}>
                        {msg.action.type === 'life_event' && 'Event Added'}
                        {msg.action.type === 'data_request' && 'Data Retrieved'}
                        {msg.action.type === 'recommendation' && 'Recommendation'}
                      </span>
                    </div>
                  )}
                  <p className={clsx(
                    'text-xs text-gray-400 mt-1',
                    msg.type === 'user' ? 'text-right' : ''
                  )}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}

              {isTyping && (
                <div className="max-w-[80%]">
                  <div className="bg-gray-200 dark:bg-gray-700 p-3 rounded-2xl rounded-tl-sm inline-block">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 overflow-x-auto">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    setInputText(action.label);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap transition-colors"
                >
                  <action.icon className="w-3 h-3" />
                  {action.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Message your mentor..."
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-full text-sm outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                className={clsx(
                  'p-2 rounded-full transition-colors',
                  inputText.trim()
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Home Indicator */}
            <div className="h-8 flex items-center justify-center bg-white dark:bg-gray-800">
              <div className="w-32 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            SMS Wellness Mentor Features
          </h3>
          <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Add life events via text message
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Check your wellness score anytime
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Get personalized recommendations
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Log feelings and check-ins
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Request detailed metric breakdowns
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Simulated user context for demo
const DEMO_USER_CONTEXT: {
  name: string;
  wellnessScore: number;
  zone: 'green' | 'yellow' | 'red';
  sleepHours: number;
  sleepTarget: number;
  hrv: number;
  steps: number;
  stepsGoal: number;
  workHours: number;
  streakDays: number;
  topFactors: string[];
} = {
  name: 'Sarah',
  wellnessScore: 62,
  zone: 'yellow',
  sleepHours: 6.2,
  sleepTarget: 7.5,
  hrv: 38,
  steps: 4200,
  stepsGoal: 8000,
  workHours: 9.5,
  streakDays: 5,
  topFactors: ['sleep', 'stress', 'work hours'],
};

// Generate mentor responses based on user input - ChatGPT-like conversation
function generateMentorResponse(userMessage: string): Message {
  const lowerMessage = userMessage.toLowerCase().trim();
  const ctx = DEMO_USER_CONTEXT;

  let response = {
    id: Date.now().toString(),
    type: 'mentor' as const,
    text: '',
    timestamp: new Date(),
    action: undefined as Message['action'],
  };

  // Greetings
  if (/^(hi|hello|hey|good morning|good afternoon|good evening|howdy|sup|what's up)/i.test(lowerMessage)) {
    const greetings = [
      `Hey there! How are you feeling today? I noticed your wellness score is at ${ctx.wellnessScore}% - would you like to chat about how things are going?`,
      `Hi! Great to hear from you. I've been tracking your metrics and have some insights to share when you're ready. What's on your mind?`,
      `Hello! I hope you're having a good day. Is there anything specific you'd like to discuss about your wellness?`,
    ];
    response.text = greetings[Math.floor(Math.random() * greetings.length)];
    return response;
  }

  // Thanks/appreciation
  if (/^(thanks|thank you|thx|appreciate|helpful)/i.test(lowerMessage)) {
    const thanks = [
      "You're welcome! I'm always here if you need anything else. Take care of yourself today! 💪",
      "Happy to help! Remember, small consistent steps lead to big improvements. You've got this!",
      "Anytime! Don't hesitate to reach out whenever you need support or just want to check in.",
    ];
    response.text = thanks[Math.floor(Math.random() * thanks.length)];
    return response;
  }

  // Wellness score inquiries
  if (/score|how am i|how('m| am) i doing|my stats|my status|my wellness|my health|check.*(in|up)/i.test(lowerMessage)) {
    const zoneLabel = ctx.zone === 'green' ? 'Peak' : ctx.zone === 'yellow' ? 'Moderate' : 'At Risk';
    response.text = `Your current wellness score is **${ctx.wellnessScore}%**, which puts you in the **${zoneLabel}** zone.\n\nHere's what I'm seeing:\n• Sleep: ${ctx.sleepHours} hrs (target: ${ctx.sleepTarget} hrs)\n• HRV: ${ctx.hrv}ms (indicates ${ctx.hrv < 40 ? 'elevated stress' : 'normal stress levels'})\n• Steps: ${ctx.steps.toLocaleString()} (goal: ${ctx.stepsGoal.toLocaleString()})\n• Work: ${ctx.workHours} hrs yesterday\n\nYour main areas for improvement are **${ctx.topFactors.join(', ')}**. Would you like specific tips for any of these?`;
    response.action = { type: 'data_request', data: { metric: 'score' } };
    return response;
  }

  // Sleep-related
  if (/sleep|tired|exhausted|insomnia|can't sleep|restless|fatigue/i.test(lowerMessage)) {
    if (/tips|help|improve|better|advice/i.test(lowerMessage)) {
      response.text = `Great question! Here are some evidence-based tips to improve your sleep:\n\n**Tonight:**\n• Set a "wind down" alarm 30 min before bed\n• Keep your room cool (65-68°F is optimal)\n• Try the 4-7-8 breathing technique\n\n**This week:**\n• Maintain consistent sleep/wake times\n• Limit caffeine after 2pm\n• Get morning sunlight within 30 min of waking\n\nYou're currently averaging ${ctx.sleepHours} hours. Even adding 30 minutes could boost your wellness score by 5-8 points. Want me to set a bedtime reminder?`;
      response.action = { type: 'recommendation' };
    } else {
      response.text = `I hear you - sleep is so important and it looks like you've been getting ${ctx.sleepHours} hours lately, which is below your ${ctx.sleepTarget} hour target.\n\nThis is actually your biggest opportunity for improvement right now. Poor sleep compounds other stressors and makes everything feel harder.\n\nWould you like some specific tips to improve your sleep, or would you prefer to talk about what might be keeping you up?`;
    }
    return response;
  }

  // Stress-related
  if (/stress|anxious|anxiety|overwhelmed|burnout|burned out|too much|can't cope|struggling/i.test(lowerMessage)) {
    response.text = `I'm sorry you're feeling this way - it's completely valid to feel overwhelmed sometimes. Your HRV of ${ctx.hrv}ms does suggest elevated stress levels.\n\nLet's break this down:\n\n**Right now (2 minutes):**\nTry box breathing: Inhale 4 sec → Hold 4 sec → Exhale 4 sec → Hold 4 sec. Repeat 4 times.\n\n**Today:**\n• Take a 10-min walk outside if possible\n• Identify ONE thing you can delegate or postpone\n• Set boundaries on notifications for 1 hour\n\n**This week:**\n• Consider what's driving the stress - is it workload, a specific project, or something personal?\n\nI'm here to listen if you want to talk more about what's going on. What feels most pressing right now?`;
    response.action = { type: 'recommendation' };
    return response;
  }

  // Work-related
  if (/work|job|busy|workload|meetings|project|deadline|boss|coworker|colleague/i.test(lowerMessage)) {
    response.text = `Work stress is one of the biggest factors affecting your wellness right now. I noticed you logged ${ctx.workHours} hours yesterday.\n\nA few thoughts:\n\n• **Meetings:** Consider blocking "focus time" on your calendar - even 90 minutes of uninterrupted work can significantly reduce stress\n• **Boundaries:** What time did you stop working yesterday? Consistent "shutdown" rituals help your brain recover\n• **Priorities:** What's the ONE most important thing you need to accomplish today?\n\nWould you like to log a work-related life event (like a deadline or project) so I can adjust your wellness expectations?`;
    return response;
  }

  // Feeling/mood logging
  if (/feel|mood|emotion|today i('m| am)|i('m| am) feeling/i.test(lowerMessage)) {
    // Check for specific emotions
    if (/good|great|happy|amazing|fantastic|wonderful|better|positive/i.test(lowerMessage)) {
      response.text = `That's wonderful to hear! 🎉 It's important to acknowledge when things are going well.\n\nWhat do you think is contributing to feeling good today? Recognizing these patterns helps us understand what works best for you.\n\nKeep up the momentum - you're on a ${ctx.streakDays}-day check-in streak!`;
    } else if (/bad|terrible|awful|sad|down|depressed|upset|angry|frustrated/i.test(lowerMessage)) {
      response.text = `I'm sorry you're not feeling your best today. Thank you for sharing that with me - acknowledging how we feel is an important first step.\n\nA few gentle suggestions:\n• Be kind to yourself - it's okay to have difficult days\n• Consider a short walk or some fresh air\n• Reach out to someone you trust if you need support\n\nWould you like to talk about what's contributing to these feelings? Sometimes just expressing it can help.`;
    } else {
      response.text = `Thanks for checking in. How would you describe your energy and mood today?\n\nYou can:\n• Rate it 1-5 (1 being low, 5 being great)\n• Or just describe how you're feeling in your own words\n\nThis helps me personalize your recommendations and track patterns over time.`;
    }
    response.action = { type: 'checkin' };
    return response;
  }

  // Recommendations/tips/advice
  if (/recommend|suggest|tip|advice|help me|what should|what can i|how can i|improve/i.test(lowerMessage)) {
    response.text = `Based on your current data, here are my personalized recommendations:\n\n**🎯 Top Priority: Sleep**\nYou're averaging ${ctx.sleepHours} hrs vs your ${ctx.sleepTarget} hr target. Try getting to bed 30 minutes earlier tonight.\n\n**⚡ Quick Win: Movement**\nYou're at ${ctx.steps.toLocaleString()} steps. A 15-min walk would get you closer to your goal and reduce stress.\n\n**🧘 Stress Relief:**\nYour HRV suggests elevated stress. Try the "5-4-3-2-1" grounding technique: Name 5 things you see, 4 you hear, 3 you can touch, 2 you smell, 1 you taste.\n\nWhich of these would you like to focus on? I can give you more specific guidance.`;
    response.action = { type: 'recommendation' };
    return response;
  }

  // Life events
  if (/life event|add event|log event|record event/i.test(lowerMessage)) {
    response.text = `I can help you log a life event! These help me understand context and adjust your wellness expectations.\n\nJust tell me what's happening. For example:\n• "I started a new job"\n• "Going on vacation next week"\n• "Started new medication"\n• "Dealing with a family issue"\n• "Big project deadline coming up"\n\nWhat would you like to add?`;
    return response;
  }

  // Exercise/activity
  if (/exercise|workout|gym|run|walk|active|activity|steps|move/i.test(lowerMessage)) {
    response.text = `Physical activity is a powerful wellness booster! Here's where you stand:\n\n• **Today's steps:** ${ctx.steps.toLocaleString()} / ${ctx.stepsGoal.toLocaleString()} goal\n• **Impact:** Regular movement can improve your HRV by 10-15% and boost mood significantly\n\n**Easy wins:**\n• Take calls while walking\n• 5-min stretch break every hour\n• Park farther away or take stairs\n\nEven a 10-minute walk can reduce stress hormones and improve focus for 2+ hours. Would you like me to remind you to take movement breaks?`;
    return response;
  }

  // Yes/affirmative responses
  if (/^(yes|yeah|yep|sure|ok|okay|please|definitely|absolutely)/i.test(lowerMessage)) {
    response.text = `Great! I've made a note of that.\n\nIs there anything specific you'd like to focus on right now? I can help with:\n• Checking your wellness score\n• Getting personalized recommendations\n• Logging how you're feeling\n• Adding a life event\n\nJust let me know!`;
    return response;
  }

  // No/negative responses
  if (/^(no|nope|nah|not really|i'm good|no thanks)/i.test(lowerMessage)) {
    response.text = `No problem! I'm here whenever you need me.\n\nJust a gentle reminder: Your wellness score is ${ctx.wellnessScore}%, and the biggest opportunity for improvement is ${ctx.topFactors[0]}. Small changes add up!\n\nFeel free to reach out anytime. 💙`;
    return response;
  }

  // Numbers (likely a rating)
  if (/^[1-5]$/.test(lowerMessage.trim())) {
    const rating = parseInt(lowerMessage.trim());
    const responses: Record<number, string> = {
      1: "I'm sorry to hear you're having such a tough time. Please remember that difficult days are temporary. Consider reaching out to a friend, taking a short walk, or doing something small that brings you comfort. I'm here if you want to talk about what's going on.",
      2: "Thanks for being honest. Below-average days happen, and acknowledging them is important. What's one small thing that might help you feel a bit better today? Even a 5-minute break or a cup of tea can help.",
      3: "An average day - that's okay! Consistency matters. Is there anything specific you'd like to work on to move toward a 4 or 5? Sometimes small adjustments make a big difference.",
      4: "That's good to hear! What's contributing to your positive mood today? Recognizing these patterns helps us understand what works best for you.",
      5: "Fantastic! 🎉 It's great that you're feeling excellent. What's working well for you? Let's make sure we can replicate these conditions.",
    };
    response.text = responses[rating];
    response.action = { type: 'checkin' };
    return response;
  }

  // Default - conversational fallback
  const fallbacks = [
    `I want to make sure I understand you correctly. Could you tell me more about what you're looking for? I can help with wellness scores, recommendations, logging feelings, or adding life events.`,
    `Thanks for sharing. I'm here to support your wellness journey. What would be most helpful right now - checking your stats, getting some recommendations, or just chatting about how you're doing?`,
    `I appreciate you reaching out! To give you the best support, could you let me know what's on your mind? Whether it's stress, sleep, work, or just wanting to check in - I'm here to help.`,
  ];
  response.text = fallbacks[Math.floor(Math.random() * fallbacks.length)];

  return response;
}

export default WellnessMentorPreview;
