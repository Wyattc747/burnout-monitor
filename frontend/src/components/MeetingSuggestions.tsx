'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set());

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['meeting-suggestions'],
    queryFn: fetchMeetingSuggestions,
  });

  const handleSchedule = (employeeId: string, employeeName: string) => {
    setScheduledIds(prev => new Set(prev).add(employeeId));
    // In a real app, this would open a calendar integration or scheduling modal
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse h-full">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm h-full">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">1:1 Meeting Suggestions</h2>
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No meeting suggestions at this time.</p>
        </div>
      </div>
    );
  }

  // Sort by urgency
  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const urgencyOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1:1 Meeting Suggestions</h2>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
          {suggestions.length} suggested
        </span>
      </div>

      <div className="space-y-2">
        {sortedSuggestions.map((suggestion) => {
          const urgencyStyle = URGENCY_STYLES[suggestion.urgency];
          const zoneColor = suggestion.zone === 'red' ? 'bg-red-500' :
                            suggestion.zone === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500';
          const reasonLabel = REASON_LABELS[suggestion.reason] || suggestion.reason;
          return (
            <div
              key={suggestion.employeeId}
              className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="relative">
                <Avatar
                  name={suggestion.employeeName}
                  size="sm"
                />
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${zoneColor}`}></span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                  {suggestion.employeeName}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {reasonLabel}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${urgencyStyle.bg} ${urgencyStyle.text}`}>
                  {suggestion.urgency}
                </span>
                {scheduledIds.has(suggestion.employeeId) ? (
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    ✓ Scheduled
                  </span>
                ) : (
                  <button
                    onClick={() => handleSchedule(suggestion.employeeId, suggestion.employeeName)}
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                  >
                    Schedule
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MeetingSuggestions;
