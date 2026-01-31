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
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm animate-pulse">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-3"></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">1:1 Meeting Suggestions</h2>
        <div className="text-center py-4">
          <p className="text-gray-500 dark:text-gray-400 text-sm">No meeting suggestions at this time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1:1 Meeting Suggestions</h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {suggestions.length} suggested
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {suggestions.map((suggestion) => {
          const urgencyStyle = URGENCY_STYLES[suggestion.urgency];
          const zoneColor = suggestion.zone === 'red' ? 'bg-red-500' :
                            suggestion.zone === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500';
          return (
            <div
              key={suggestion.employeeId}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <Avatar
                name={suggestion.employeeName}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {suggestion.employeeName}
                  </h4>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${zoneColor}`}></span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`px-1.5 py-0.5 text-xs rounded ${urgencyStyle.bg} ${urgencyStyle.text}`}>
                    {suggestion.urgency}
                  </span>
                  <button className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                    Schedule
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
