'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Avatar } from './Avatar';
import { integrationsApi } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface MeetingSuggestion {
  employeeId: string;
  employeeName: string;
  zone: 'green' | 'yellow' | 'red';
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  reason: string;
}

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  reason: string;
  onSchedule: (dateTime: Date, duration: number) => void;
}

async function fetchMeetingSuggestions(): Promise<MeetingSuggestion[]> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/teams/meeting-suggestions`, {
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

function ScheduleModal({ isOpen, onClose, employeeName, reason, onSchedule }: ScheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [calendarType, setCalendarType] = useState<'google' | 'outlook' | 'ical'>('google');

  if (!isOpen) return null;

  // Generate suggested times (next 5 business days, common meeting times)
  const suggestedTimes: Array<{ date: string; time: string; label: string }> = [];
  const now = new Date();
  for (let i = 1; i <= 5; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    if (date.getDay() !== 0 && date.getDay() !== 6) { // Skip weekends
      ['09:00', '10:00', '14:00', '15:00'].forEach(time => {
        suggestedTimes.push({
          date: date.toISOString().split('T')[0],
          time,
          label: `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`
        });
      });
    }
  }

  const handleSubmit = () => {
    if (selectedDate && selectedTime) {
      const dateTime = new Date(`${selectedDate}T${selectedTime}`);
      onSchedule(dateTime, duration);
    }
  };

  const generateCalendarUrl = () => {
    if (!selectedDate || !selectedTime) return '';

    const startDate = new Date(`${selectedDate}T${selectedTime}`);
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    const title = encodeURIComponent(`1:1 with ${employeeName}`);
    const description = encodeURIComponent(`Check-in meeting: ${REASON_LABELS[reason] || reason}`);

    if (calendarType === 'google') {
      const start = startDate.toISOString().replace(/-|:|\.\d+/g, '');
      const end = endDate.toISOString().replace(/-|:|\.\d+/g, '');
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${description}`;
    } else if (calendarType === 'outlook') {
      const start = startDate.toISOString();
      const end = endDate.toISOString();
      return `https://outlook.office.com/calendar/0/deeplink/compose?subject=${title}&startdt=${start}&enddt=${end}&body=${description}`;
    } else {
      // Generate ICS content for download
      const start = startDate.toISOString().replace(/-|:|\.\d+/g, '');
      const end = endDate.toISOString().replace(/-|:|\.\d+/g, '');
      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'BEGIN:VEVENT',
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:1:1 with ${employeeName}`,
        `DESCRIPTION:${REASON_LABELS[reason] || reason}`,
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\n');
      return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Schedule 1:1 with {employeeName}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Quick select times */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Quick Select
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
              {suggestedTimes.slice(0, 8).map((st, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedDate(st.date);
                    setSelectedTime(st.time);
                  }}
                  className={`text-xs p-2 rounded-lg border transition-colors ${
                    selectedDate === st.date && selectedTime === st.time
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date/time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration</label>
            <div className="flex gap-2">
              {[15, 30, 45, 60].map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                    duration === d
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>

          {/* Calendar type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add to Calendar</label>
            <div className="flex gap-2">
              {[
                { id: 'google', label: '📅 Google', icon: '' },
                { id: 'outlook', label: '📧 Outlook', icon: '' },
                { id: 'ical', label: '📎 Download', icon: '' },
              ].map((cal) => (
                <button
                  key={cal.id}
                  onClick={() => setCalendarType(cal.id as typeof calendarType)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                    calendarType === cal.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {cal.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            {selectedDate && selectedTime ? (
              <a
                href={generateCalendarUrl()}
                target={calendarType === 'ical' ? undefined : '_blank'}
                download={calendarType === 'ical' ? `1-1-${employeeName.replace(/\s+/g, '-')}.ics` : undefined}
                onClick={() => {
                  handleSubmit();
                  setTimeout(onClose, 500);
                }}
                className="flex-1 py-2 px-4 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors text-center"
              >
                {calendarType === 'ical' ? 'Download .ics' : 'Open Calendar'}
              </a>
            ) : (
              <button
                disabled
                className="flex-1 py-2 px-4 text-sm font-medium text-gray-400 bg-gray-200 dark:bg-gray-600 rounded-lg cursor-not-allowed"
              >
                Select a time
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MeetingSuggestions() {
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set());
  const [modalData, setModalData] = useState<{ isOpen: boolean; employeeId: string; employeeName: string; reason: string } | null>(null);

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['meeting-suggestions'],
    queryFn: fetchMeetingSuggestions,
  });

  const handleOpenModal = (employeeId: string, employeeName: string, reason: string) => {
    setModalData({ isOpen: true, employeeId, employeeName, reason });
  };

  const handleCloseModal = () => {
    setModalData(null);
  };

  const handleScheduleComplete = (dateTime: Date, duration: number) => {
    if (modalData) {
      setScheduledIds(prev => new Set(prev).add(modalData.employeeId));
    }
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
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Scheduled
                  </span>
                ) : (
                  <button
                    onClick={() => handleOpenModal(suggestion.employeeId, suggestion.employeeName, suggestion.reason)}
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

      {/* Schedule Modal */}
      {modalData && (
        <ScheduleModal
          isOpen={modalData.isOpen}
          onClose={handleCloseModal}
          employeeName={modalData.employeeName}
          reason={modalData.reason}
          onSchedule={handleScheduleComplete}
        />
      )}
    </div>
  );
}

export default MeetingSuggestions;
