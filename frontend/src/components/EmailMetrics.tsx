'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface EmailMetric {
  date: string;
  emailsReceived: number;
  emailsSent: number;
  emailsRead: number;
  emailsOutsideHours: number;
  earliestEmailTime: string | null;
  latestEmailTime: string | null;
  activeThreads: number;
}

async function fetchEmailMetrics(): Promise<EmailMetric[]> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/integrations/gmail/metrics?limit=14`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch email metrics');
  return res.json();
}

function StatCard({ label, value, subValue, trend }: {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">{value}</span>
        {subValue && (
          <span className="text-sm text-gray-500 dark:text-gray-400">{subValue}</span>
        )}
      </div>
      {trend && (
        <div className={`mt-1 flex items-center gap-1 text-xs ${
          trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-emerald-500' : 'text-gray-400'
        }`}>
          {trend === 'up' && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          )}
          {trend === 'down' && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          )}
          <span>vs last week</span>
        </div>
      )}
    </div>
  );
}

export function EmailMetrics() {
  const { data: metrics = [], isLoading, isError } = useQuery({
    queryKey: ['email-metrics'],
    queryFn: fetchEmailMetrics,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || metrics.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Email Activity</h2>
        <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">Connect Gmail to see email metrics</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Track email patterns and after-hours activity
          </p>
        </div>
      </div>
    );
  }

  // Calculate stats
  const thisWeek = metrics.slice(0, 7);
  const lastWeek = metrics.slice(7, 14);

  const thisWeekSent = thisWeek.reduce((sum, m) => sum + m.emailsSent, 0);
  const thisWeekReceived = thisWeek.reduce((sum, m) => sum + m.emailsReceived, 0);
  const thisWeekOutsideHours = thisWeek.reduce((sum, m) => sum + m.emailsOutsideHours, 0);

  const lastWeekSent = lastWeek.reduce((sum, m) => sum + m.emailsSent, 0);
  const lastWeekOutsideHours = lastWeek.reduce((sum, m) => sum + m.emailsOutsideHours, 0);

  const avgDaily = Math.round((thisWeekSent + thisWeekReceived) / Math.min(thisWeek.length, 7));
  const outsideHoursPct = thisWeekSent > 0 ? Math.round((thisWeekOutsideHours / thisWeekSent) * 100) : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Email Activity</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Sent this week"
          value={thisWeekSent}
          trend={thisWeekSent > lastWeekSent ? 'up' : thisWeekSent < lastWeekSent ? 'down' : 'neutral'}
        />
        <StatCard
          label="Received"
          value={thisWeekReceived}
          subValue="this week"
        />
        <StatCard
          label="Daily average"
          value={avgDaily}
          subValue="emails"
        />
        <StatCard
          label="After hours"
          value={`${outsideHoursPct}%`}
          subValue="of sent"
          trend={outsideHoursPct > 20 ? 'up' : 'neutral'}
        />
      </div>

      {/* Activity bars */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Daily Activity</h3>
        <div className="flex items-end gap-1 h-24">
          {thisWeek.slice().reverse().map((day, i) => {
            const total = day.emailsSent + day.emailsReceived;
            const maxTotal = Math.max(...thisWeek.map(d => d.emailsSent + d.emailsReceived), 1);
            const height = (total / maxTotal) * 100;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center"
              >
                <div
                  className="w-full bg-emerald-500 dark:bg-emerald-600 rounded-t transition-all duration-300 hover:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer"
                  style={{ height: `${Math.max(height, 4)}%` }}
                  title={`${new Date(day.date).toLocaleDateString()}: ${total} emails`}
                />
                <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'narrow' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Warning if high after-hours activity */}
      {outsideHoursPct > 20 && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-sm font-medium">
              {outsideHoursPct}% of your emails are sent outside work hours
            </span>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
            Consider setting boundaries to protect your personal time.
          </p>
        </div>
      )}
    </div>
  );
}

export default EmailMetrics;
