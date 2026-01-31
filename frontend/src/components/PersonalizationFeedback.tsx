'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';

interface FeedbackButtonProps {
  resourceId?: string;
  recommendationType: 'resource' | 'action' | 'prediction';
  itemTitle: string;
  onFeedback?: (feedback: 'helpful' | 'not_helpful' | 'skip') => void;
}

// Compact inline feedback buttons
export function FeedbackButtons({ resourceId, recommendationType, itemTitle, onFeedback }: FeedbackButtonProps) {
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | 'skip' | null>(null);
  const queryClient = useQueryClient();

  const submitFeedback = useMutation({
    mutationFn: async (type: 'helpful' | 'not_helpful' | 'skip') => {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/personalization/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resourceId,
          recommendationType,
          feedbackType: type,
          itemTitle,
        }),
      });
      if (!res.ok) throw new Error('Failed to submit feedback');
      return res.json();
    },
    onSuccess: (_, type) => {
      setFeedback(type);
      onFeedback?.(type);
      // Invalidate queries to potentially update recommendations
      queryClient.invalidateQueries({ queryKey: ['recommended-resources'] });
    },
  });

  if (feedback) {
    return (
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {feedback === 'helpful' ? '👍 Thanks!' : feedback === 'not_helpful' ? '👎 Noted' : 'Skipped'}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => submitFeedback.mutate('helpful')}
        disabled={submitFeedback.isPending}
        className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
        title="This was helpful"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
      </button>
      <button
        onClick={() => submitFeedback.mutate('not_helpful')}
        disabled={submitFeedback.isPending}
        className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        title="Not helpful"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
        </svg>
      </button>
    </div>
  );
}

// Score accuracy feedback
interface ScoreFeedbackProps {
  actualScore: number;
  onFeedback?: (adjustedScore: number) => void;
}

export function ScoreFeedback({ actualScore, onFeedback }: ScoreFeedbackProps) {
  const [showSlider, setShowSlider] = useState(false);
  const [adjustedScore, setAdjustedScore] = useState(actualScore);
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();

  const submitFeedback = useMutation({
    mutationFn: async (score: number) => {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/personalization/score-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          algorithmScore: actualScore,
          userPerceivedScore: score,
          discrepancy: score - actualScore,
        }),
      });
      if (!res.ok) throw new Error('Failed to submit feedback');
      return res.json();
    },
    onSuccess: (_, score) => {
      setSubmitted(true);
      onFeedback?.(score);
      queryClient.invalidateQueries({ queryKey: ['personalization'] });
    },
  });

  if (submitted) {
    return (
      <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Feedback recorded
      </div>
    );
  }

  if (!showSlider) {
    return (
      <button
        onClick={() => setShowSlider(true)}
        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
      >
        Does this feel accurate?
      </button>
    );
  }

  return (
    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <p className="text-xs text-gray-700 dark:text-gray-300 mb-2">
        How stressed do you <strong>actually</strong> feel? (1-100)
      </p>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min="0"
          max="100"
          value={adjustedScore}
          onChange={(e) => setAdjustedScore(parseInt(e.target.value))}
          className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-500"
        />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-8">
          {adjustedScore}
        </span>
      </div>
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => submitFeedback.mutate(adjustedScore)}
          disabled={submitFeedback.isPending}
          className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Submit
        </button>
        <button
          onClick={() => setShowSlider(false)}
          className="text-xs px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Full personalization feedback panel
export function PersonalizationFeedbackPanel() {
  const [showPanel, setShowPanel] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, string>>({});

  const ACCURACY_QUESTIONS = [
    { id: 'sleep', question: 'Are your sleep recommendations helpful?', icon: '😴' },
    { id: 'workload', question: 'Is workload tracking accurate?', icon: '💼' },
    { id: 'stress', question: 'Does stress detection match how you feel?', icon: '😓' },
    { id: 'recommendations', question: 'Are wellness suggestions relevant?', icon: '💡' },
  ];

  const handleFeedback = (id: string, response: 'yes' | 'somewhat' | 'no') => {
    setFeedbackGiven(prev => ({ ...prev, [id]: response }));
  };

  const answeredCount = Object.keys(feedbackGiven).length;
  const allAnswered = answeredCount === ACCURACY_QUESTIONS.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Help Us Improve</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Your feedback helps personalize recommendations
          </p>
        </div>
        <button
          onClick={() => setShowPanel(!showPanel)}
          className={clsx(
            'text-sm px-3 py-1 rounded-lg transition-colors',
            showPanel
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
          )}
        >
          {showPanel ? 'Hide' : 'Give Feedback'}
        </button>
      </div>

      {showPanel && (
        <div className="space-y-4 animate-fade-in">
          {ACCURACY_QUESTIONS.map((q) => (
            <div key={q.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{q.icon}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300">{q.question}</span>
              </div>
              {feedbackGiven[q.id] ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  {feedbackGiven[q.id] === 'yes' ? '✓ Great!' : feedbackGiven[q.id] === 'somewhat' ? '✓ Noted' : '✓ We\'ll improve'}
                </span>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFeedback(q.id, 'yes')}
                    className="text-xs px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => handleFeedback(q.id, 'somewhat')}
                    className="text-xs px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                  >
                    Somewhat
                  </button>
                  <button
                    onClick={() => handleFeedback(q.id, 'no')}
                    className="text-xs px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          ))}

          {allAnswered && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-center">
              <p className="text-emerald-800 dark:text-emerald-200 font-medium">
                🎉 Thank you for your feedback!
              </p>
              <p className="text-sm text-emerald-600 dark:text-emerald-300 mt-1">
                Your responses will help improve our recommendations.
              </p>
            </div>
          )}

          {!allAnswered && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {answeredCount}/{ACCURACY_QUESTIONS.length} questions answered
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PersonalizationFeedbackPanel;
