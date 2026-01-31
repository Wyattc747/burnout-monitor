'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { employeesApi } from '@/lib/api';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface SmartRecommendationsProps {
  employeeId: string;
  compact?: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  stress: '😤',
  sleep: '😴',
  mindfulness: '🧘',
  exercise: '🏃',
  productivity: '⚡',
  nutrition: '🥗',
};

const CATEGORY_COLORS: Record<string, string> = {
  stress: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  sleep: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  mindfulness: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  exercise: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  productivity: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  nutrition: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
};

// Detailed content for each recommendation type
const RECOMMENDATION_DETAILS: Record<string, { steps: string[]; benefits: string[]; tips: string }> = {
  'breathing-exercise': {
    steps: [
      'Find a quiet, comfortable place to sit or lie down',
      'Close your eyes and take a deep breath in through your nose for 4 seconds',
      'Hold your breath for 4 seconds',
      'Slowly exhale through your mouth for 6 seconds',
      'Repeat this cycle 5-10 times'
    ],
    benefits: ['Reduces stress hormones', 'Lowers heart rate', 'Improves focus', 'Can be done anywhere'],
    tips: 'Try setting a reminder to do this exercise 2-3 times throughout your workday, especially before or after stressful meetings.'
  },
  'power-nap': {
    steps: [
      'Find a quiet spot where you won\'t be disturbed',
      'Set an alarm for 15-20 minutes',
      'Lie down or recline in a comfortable position',
      'Close your eyes and relax your muscles',
      'Wake up when the alarm goes off - don\'t hit snooze!'
    ],
    benefits: ['Boosts alertness and productivity', 'Improves memory and learning', 'Reduces fatigue', 'Enhances mood'],
    tips: 'The ideal time for a power nap is between 1-3 PM. Avoid napping after 4 PM as it may interfere with nighttime sleep.'
  },
  'desk-stretch': {
    steps: [
      'Stand up and push your chair back',
      'Reach your arms overhead and stretch tall',
      'Roll your shoulders backwards 5 times, then forwards 5 times',
      'Gently tilt your head to each side, holding for 10 seconds',
      'Twist your torso left and right while keeping hips facing forward'
    ],
    benefits: ['Relieves muscle tension', 'Improves posture', 'Increases blood flow', 'Reduces risk of repetitive strain'],
    tips: 'Set a reminder to stretch every hour. Your body will thank you at the end of the day!'
  },
  'walking-break': {
    steps: [
      'Step away from your desk completely',
      'Take a 10-15 minute walk, preferably outdoors',
      'Leave your phone behind or on silent',
      'Focus on your surroundings and breathing',
      'Return to work refreshed'
    ],
    benefits: ['Clears your mind', 'Boosts creativity', 'Improves cardiovascular health', 'Reduces stress'],
    tips: 'Walking meetings can be a great way to get movement while still being productive. Suggest it for your next 1-on-1!'
  },
  'hydration-reminder': {
    steps: [
      'Fill a large water bottle (aim for 32oz/1L)',
      'Keep it visible on your desk',
      'Take sips regularly throughout the day',
      'Track your intake if helpful',
      'Aim for 8 glasses (64oz) minimum daily'
    ],
    benefits: ['Improves concentration', 'Reduces fatigue', 'Supports metabolism', 'Helps regulate body temperature'],
    tips: 'Try adding lemon, cucumber, or mint to your water for variety. Herbal teas count toward your daily intake too!'
  },
  'mindfulness-meditation': {
    steps: [
      'Find a quiet space and sit comfortably',
      'Set a timer for 5-10 minutes',
      'Close your eyes and focus on your breath',
      'When your mind wanders, gently bring focus back to breathing',
      'End by taking three deep breaths and slowly opening your eyes'
    ],
    benefits: ['Reduces anxiety', 'Improves emotional regulation', 'Enhances self-awareness', 'Boosts focus and clarity'],
    tips: 'Consistency matters more than duration. Even 5 minutes daily is beneficial. Consider using a guided meditation app to get started.'
  },
  'sleep-hygiene': {
    steps: [
      'Set a consistent bedtime and wake time',
      'Avoid screens for 1 hour before bed',
      'Keep your bedroom cool, dark, and quiet',
      'Avoid caffeine after 2 PM',
      'Create a relaxing pre-sleep routine'
    ],
    benefits: ['Improves sleep quality', 'Increases daytime energy', 'Supports immune function', 'Enhances mood and cognitive function'],
    tips: 'Your body loves routine. Try to maintain your sleep schedule even on weekends for the best results.'
  },
  'task-prioritization': {
    steps: [
      'List all your tasks for the day',
      'Identify the 3 most important tasks (MITs)',
      'Block time on your calendar for MITs first',
      'Batch similar tasks together',
      'Review and adjust at end of day'
    ],
    benefits: ['Reduces overwhelm', 'Increases productivity', 'Improves focus', 'Creates sense of accomplishment'],
    tips: 'Try the "eat the frog" method - tackle your most challenging task first thing in the morning when your energy is highest.'
  },
};

// Default details for recommendations without specific content
const DEFAULT_DETAILS = {
  steps: [
    'Take a moment to step away from your current task',
    'Find a comfortable and quiet space',
    'Follow the activity for the recommended duration',
    'Notice how you feel before and after',
    'Consider making this a regular practice'
  ],
  benefits: ['Improves overall wellbeing', 'Reduces stress', 'Boosts energy levels', 'Enhances mental clarity'],
  tips: 'Consistency is key! Try to incorporate this into your daily routine for the best results.'
};

export function SmartRecommendations({ employeeId, compact = false }: SmartRecommendationsProps) {
  const [selectedResource, setSelectedResource] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['recommended-resources', employeeId],
    queryFn: () => employeesApi.getRecommendedResources(employeeId),
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className={compact ? "space-y-2" : "grid grid-cols-2 gap-3"}>
          {[1, 2, compact ? 0 : 3, compact ? 0 : 4].filter(Boolean).map(i => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data?.recommendations?.length) {
    return null;
  }

  const { recommendations, targetedCategories } = data;
  const displayRecommendations = compact ? recommendations.slice(0, 2) : recommendations;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {compact ? 'Top Recommendations' : 'Recommended for You'}
            </h3>
            {!compact && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Based on your current wellness factors
              </p>
            )}
          </div>
          {!compact && (
            <div className="flex gap-1">
              {targetedCategories.map((cat: string) => (
                <span
                  key={cat}
                  className={`px-2 py-1 text-xs rounded-full ${CATEGORY_COLORS[cat] || 'bg-gray-100 dark:bg-gray-700'}`}
                >
                  {CATEGORY_ICONS[cat] || '📚'} {cat}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={compact ? "space-y-2" : "grid sm:grid-cols-2 gap-3"}>
          {displayRecommendations.map((resource: any) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              compact={compact}
              onClick={() => setSelectedResource(resource)}
            />
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedResource && (
        <ResourceDetailModal
          resource={selectedResource}
          onClose={() => setSelectedResource(null)}
        />
      )}
    </>
  );
}

function ResourceCard({
  resource,
  compact = false,
  onClick
}: {
  resource: any;
  compact?: boolean;
  onClick: () => void;
}) {
  const categoryColor = CATEGORY_COLORS[resource.category] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
  const icon = CATEGORY_ICONS[resource.category] || '📚';

  return (
    <button
      className={`text-left w-full rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all ${compact ? 'p-3' : 'p-4'}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <span className={compact ? "text-xl" : "text-2xl"}>{icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
            {resource.title}
          </h4>
          {!compact && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
              {resource.reason}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-1.5 py-0.5 text-xs rounded ${categoryColor}`}>
              {resource.category}
            </span>
            {resource.durationMinutes && (
              <span className="text-xs text-gray-400">{resource.durationMinutes} min</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function ResourceDetailModal({ resource, onClose }: { resource: any; onClose: () => void }) {
  const icon = CATEGORY_ICONS[resource.category] || '📚';
  const categoryColor = CATEGORY_COLORS[resource.category] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';

  // Get detailed content or use defaults
  const resourceId = resource.id?.toLowerCase().replace(/\s+/g, '-') || '';
  const details = RECOMMENDATION_DETAILS[resourceId] || DEFAULT_DETAILS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{icon}</span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {resource.title}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 text-xs rounded-full ${categoryColor}`}>
                  {resource.category}
                </span>
                {resource.durationMinutes && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {resource.durationMinutes} minutes
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Why This Was Recommended */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Why This Was Recommended
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {resource.reason || 'Based on your current wellness metrics, this activity can help improve your overall wellbeing.'}
            </p>
          </div>

          {/* How To Do It */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              How To Do It
            </h3>
            <ol className="space-y-2">
              {details.steps.map((step, index) => (
                <li key={index} className="flex gap-3 text-sm text-gray-600 dark:text-gray-400">
                  <span className={clsx(
                    'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                    categoryColor
                  )}>
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Benefits */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Benefits
            </h3>
            <ul className="grid grid-cols-2 gap-2">
              {details.benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <span className="text-emerald-500">✓</span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro Tip */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex gap-2">
              <span className="text-amber-600">💡</span>
              <div>
                <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">Pro Tip</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {details.tips}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <button
            onClick={onClose}
            className="w-full btn btn-primary"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}

export default SmartRecommendations;
