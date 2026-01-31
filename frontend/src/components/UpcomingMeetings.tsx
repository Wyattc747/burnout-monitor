'use client';

import { useQuery } from '@tanstack/react-query';
import { integrationsApi } from '@/lib/api';
import { clsx } from 'clsx';

interface Meeting {
  id: string;
  title: string;
  start: string;
  end: string;
  duration: number;
  attendees: { email: string; name?: string; responseStatus: string }[];
  location?: string;
  meetLink?: string;
}

export function UpcomingMeetings() {
  const { data: status } = useQuery({
    queryKey: ['integrations', 'status'],
    queryFn: integrationsApi.getStatus,
  });

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['google', 'upcoming'],
    queryFn: () => integrationsApi.getGoogleUpcoming(5),
    enabled: status?.googleCalendar?.connected,
  });

  if (!status?.googleCalendar?.connected) {
    return (
      <div className="card">
        <h3 className="section-header mb-4">Upcoming Meetings</h3>
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
            Connect Google Calendar to see upcoming meetings
          </p>
          <ConnectGoogleButton />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card">
        <h3 className="section-header mb-4">Upcoming Meetings</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!meetings || meetings.length === 0) {
    return (
      <div className="card">
        <h3 className="section-header mb-4">Upcoming Meetings</h3>
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p>No upcoming meetings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="section-header mb-4">Upcoming Meetings</h3>
      <div className="space-y-3">
        {meetings.map((meeting: Meeting) => (
          <MeetingCard key={meeting.id} meeting={meeting} />
        ))}
      </div>
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const startDate = new Date(meeting.start);
  const isToday = new Date().toDateString() === startDate.toDateString();
  const isTomorrow =
    new Date(Date.now() + 86400000).toDateString() === startDate.toDateString();

  const timeStr = startDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const dateStr = isToday
    ? 'Today'
    : isTomorrow
    ? 'Tomorrow'
    : startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 dark:text-white truncate">
            {meeting.title}
          </p>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span className={clsx(isToday && 'text-blue-600 dark:text-blue-400 font-medium')}>
              {dateStr}
            </span>
            <span>at {timeStr}</span>
            <span className="text-gray-400 dark:text-gray-500">({meeting.duration} min)</span>
          </div>
          {meeting.attendees.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {meeting.attendees.length} attendee{meeting.attendees.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
        {meeting.meetLink && (
          <a
            href={meeting.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary text-xs px-3 py-1.5 flex-shrink-0"
          >
            Join
          </a>
        )}
      </div>
    </div>
  );
}

export function ConnectGoogleButton() {
  const handleConnect = async () => {
    try {
      const { url } = await integrationsApi.getGoogleAuthUrl();
      window.location.href = url;
    } catch (err) {
      console.error('Failed to get Google auth URL:', err);
    }
  };

  return (
    <button
      onClick={handleConnect}
      className="btn btn-secondary flex items-center gap-2"
    >
      <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
      Connect Google Calendar
    </button>
  );
}
