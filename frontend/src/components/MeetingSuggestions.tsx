'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar } from './Avatar';

interface MeetingSuggestion {
  employeeId: string;
  employeeName: string;
  zone: 'green' | 'yellow' | 'red';
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  reason: string;
}

async function fetchMeetingSuggestions(): Promise<MeetingSuggestion[]> {
  const token = localStorage.getItem('token');
  const res = await fetch('http://localhost:3001/api/teams/meeting-suggestions', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch meeting suggestions');
  return res.json();
}

const URGENCY_STYLES = {
  low: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
  },
  normal: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
  },
  high: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
  },
  urgent: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-600 dark:text-red-400',
  },
};

const REASON_LABELS: Record<string, string> = {
  declining_wellness: 'Wellness declining',
  needs_support: 'May need support',
  celebrate_success: 'Celebrate success',
  routine_checkin: 'Routine check-in',
};

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function MeetingSuggestions() {
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['meeting-suggestions'],
    queryFn: fetchMeetingSuggestions,
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">1:1 Meeting Suggestions</h2>
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">No meeting suggestions at this time.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            We'll suggest meetings when team members may benefit from a check-in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">1:1 Meeting Suggestions</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {suggestions.length} suggested meeting{suggestions.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {suggestions.map((suggestion) => {
          const urgencyStyle = URGENCY_STYLES[suggestion.urgency];
          const zoneColor = suggestion.zone === 'red' ? 'bg-red-500' :
                            suggestion.zone === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500';
          return (
            <div
              key={suggestion.employeeId}
              className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <Avatar
                name={suggestion.employeeName}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {suggestion.employeeName}
                  </h4>
                  <span className={`w-2 h-2 rounded-full ${zoneColor}`}></span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${urgencyStyle.bg} ${urgencyStyle.text}`}>
                    {suggestion.urgency}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {suggestion.reason}
                </p>

                <div className="mt-3 flex gap-2">
                  <button className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
                    Schedule Meeting
                  </button>
                  <button className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MeetingSuggestions;
