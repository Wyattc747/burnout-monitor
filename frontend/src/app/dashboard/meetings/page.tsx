'use client';

import { useQuery } from '@tanstack/react-query';
import { teamsApi } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { MeetingSuggestions } from '@/components/MeetingSuggestions';
import { UpcomingMeetings } from '@/components/UpcomingMeetings';
import Link from 'next/link';
import { clsx } from 'clsx';
import type { Employee } from '@/types';
import { ChevronLeft, Calendar, Users, Clock, AlertCircle } from 'lucide-react';

export default function MeetingsPage() {
  const { user, isLoading: authLoading } = useRequireAuth({ requiredRoles: ['manager', 'admin', 'super_admin'] });

  const { data: employees, isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: teamsApi.getMembers,
    enabled: !!user,
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Get employees who need 1:1s (red zone or high burnout)
  const needsMeeting = employees?.filter((e: Employee) =>
    e.zone === 'red' || (e.burnoutScore && e.burnoutScore > 60)
  ) || [];

  // Get employees in yellow zone
  const yellowZone = employees?.filter((e: Employee) => e.zone === 'yellow') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 mb-2"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Meetings & 1:1s
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Schedule and manage team check-ins
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard
          icon={<AlertCircle className="w-5 h-5 text-red-500" />}
          label="Need Immediate 1:1"
          value={needsMeeting.length}
          sublabel="High burnout risk"
          color="red"
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-amber-500" />}
          label="Should Check In"
          value={yellowZone.length}
          sublabel="Moderate zone"
          color="yellow"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-blue-500" />}
          label="Team Size"
          value={employees?.length || 0}
          sublabel="Total members"
          color="blue"
        />
      </div>

      {/* Priority 1:1s */}
      {needsMeeting.length > 0 && (
        <div className="card border-l-4 border-red-500">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            Priority Check-ins Needed
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            These team members have elevated burnout risk and would benefit from a 1:1 meeting.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {needsMeeting.map((employee: Employee) => (
              <EmployeeMeetingCard key={employee.id} employee={employee} />
            ))}
          </div>
        </div>
      )}

      {/* Meeting Suggestions */}
      <MeetingSuggestions />

      {/* Upcoming Meetings */}
      <UpcomingMeetings />

      {/* 1:1 Tips */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
          Effective 1:1 Meeting Tips
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <TipCard
            icon="🎯"
            title="Focus on the Person"
            description="Ask about their wellbeing before diving into work topics."
          />
          <TipCard
            icon="👂"
            title="Listen Actively"
            description="Let them share concerns without interrupting or jumping to solutions."
          />
          <TipCard
            icon="🤝"
            title="Offer Support"
            description="Ask 'How can I help?' and follow through on commitments."
          />
          <TipCard
            icon="📅"
            title="Be Consistent"
            description="Regular meetings build trust and catch issues early."
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sublabel: string;
  color: 'red' | 'yellow' | 'blue';
}) {
  const colorClasses = {
    red: 'text-red-600 dark:text-red-400',
    yellow: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className={clsx('text-2xl font-bold', colorClasses[color])}>{value}</p>
          <p className="text-xs text-gray-400">{sublabel}</p>
        </div>
      </div>
    </div>
  );
}

function EmployeeMeetingCard({ employee }: { employee: Employee }) {
  const initials = `${employee.firstName[0]}${employee.lastName[0]}`;

  return (
    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white font-semibold text-sm">
          {initials}
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {employee.firstName} {employee.lastName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Burnout Risk: {employee.burnoutScore}%
          </p>
        </div>
      </div>
      <Link
        href={`/dashboard/employee/${employee.id}`}
        className="text-sm text-red-600 dark:text-red-400 hover:underline"
      >
        View →
      </Link>
    </div>
  );
}

function TipCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <span className="text-2xl">{icon}</span>
      <div>
        <h4 className="font-medium text-gray-900 dark:text-white">{title}</h4>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      </div>
    </div>
  );
}
