'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar } from './Avatar';
import { interventionsApi } from '@/lib/api';
import type { ConversationTemplate, InterventionType, Zone } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface MeetingSuggestion {
  employeeId: string;
  employeeName: string;
  zone: Zone;
  urgency: 'low' | 'normal' | 'high' | 'urgent';
  reason: string;
  burnoutScore?: number;
}

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  zone: Zone;
  reason: string;
  burnoutScore?: number;
  onSchedule: (dateTime: Date, duration: number, templateId?: string) => void;
}

interface LogOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  zone: Zone;
  scheduledDate?: Date;
  onLogOutcome: (data: {
    type: InterventionType;
    notes: string;
    actionsTaken: string[];
    followUpDate?: string;
    templateUsed?: string;
  }) => void;
}

async function fetchMeetingSuggestions(): Promise<MeetingSuggestion[]> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/teams/meeting-suggestions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch meeting suggestions');
  return res.json();
}

// Default conversation templates (fallback if API fails)
const DEFAULT_TEMPLATES: ConversationTemplate[] = [
  {
    id: 'wellness-check',
    name: 'Wellness Check-in',
    category: 'wellness_check',
    description: 'General wellness and work-life balance discussion',
    openingQuestions: [
      'How are you feeling about your workload lately?',
      'Is there anything on your mind that you would like to discuss?',
      'How has your energy been this week?',
    ],
    followUpQuestions: [
      'What would help you feel more balanced?',
      'Are there any blockers I can help remove?',
      'How can I better support you?',
    ],
    suggestedActions: [
      'Adjust workload or deadlines',
      'Provide additional resources',
      'Schedule follow-up check-in',
    ],
    applicableZones: ['red', 'yellow', 'green'],
  },
  {
    id: 'burnout-support',
    name: 'Burnout Support',
    category: 'support',
    description: 'Focused conversation for employees showing signs of burnout',
    openingQuestions: [
      'I noticed your wellness scores have been declining. How are you really doing?',
      'What has been the most challenging part of your work recently?',
      'Are you getting enough rest and recovery time?',
    ],
    followUpQuestions: [
      'What would make the biggest difference for you right now?',
      'Would taking some time off help?',
      'Are there any projects we should reprioritize?',
    ],
    suggestedActions: [
      'Reduce meeting load',
      'Approve time off request',
      'Redistribute tasks to team',
      'Connect with EAP resources',
    ],
    applicableZones: ['red', 'yellow'],
  },
  {
    id: 'recognition',
    name: 'Recognition & Celebration',
    category: 'recognition',
    description: 'Acknowledge achievements and positive performance',
    openingQuestions: [
      'I wanted to recognize the great work you have been doing on [project].',
      'What accomplishment are you most proud of recently?',
      'Your wellness metrics look great - what is working well for you?',
    ],
    followUpQuestions: [
      'What goals would you like to work toward next?',
      'Is there any way we can help you continue this momentum?',
      'Would you be interested in mentoring others?',
    ],
    suggestedActions: [
      'Document achievements for review',
      'Discuss growth opportunities',
      'Share success with wider team',
    ],
    applicableZones: ['green'],
  },
  {
    id: 'career-growth',
    name: 'Career Development',
    category: 'performance',
    description: 'Discuss goals, growth opportunities, and career path',
    openingQuestions: [
      'Where do you see yourself in the next year?',
      'What skills would you like to develop?',
      'Are there any projects that interest you?',
    ],
    followUpQuestions: [
      'What support do you need to reach your goals?',
      'Would you like to take on any new responsibilities?',
      'Are there any training or learning opportunities you are interested in?',
    ],
    suggestedActions: [
      'Create development plan',
      'Identify stretch assignments',
      'Schedule training or mentorship',
    ],
    applicableZones: ['green', 'yellow'],
  },
];

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

const ZONE_COLORS: Record<Zone, string> = {
  red: 'bg-red-500',
  yellow: 'bg-amber-500',
  green: 'bg-emerald-500',
};

const REASON_LABELS: Record<string, string> = {
  declining_wellness: 'Wellness declining',
  needs_support: 'May need support',
  celebrate_success: 'Celebrate success',
  routine_checkin: 'Routine check-in',
};

const INTERVENTION_TYPE_OPTIONS: { value: InterventionType; label: string }[] = [
  { value: 'check_in', label: 'General Check-in' },
  { value: 'workload_adjustment', label: 'Workload Adjustment' },
  { value: 'time_off', label: 'Time Off Discussion' },
  { value: 'resource_referral', label: 'Resource Referral' },
  { value: 'recognition', label: 'Recognition' },
  { value: 'goal_setting', label: 'Goal Setting' },
  { value: 'other', label: 'Other' },
];

function TemplateDropdown({
  templates,
  selectedTemplate,
  onSelect,
  zone,
}: {
  templates: ConversationTemplate[];
  selectedTemplate: ConversationTemplate | null;
  onSelect: (template: ConversationTemplate | null) => void;
  zone: Zone;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const filteredTemplates = templates.filter((t) => t.applicableZones.includes(zone));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex items-center justify-between"
      >
        <span className={selectedTemplate ? '' : 'text-gray-500 dark:text-gray-400'}>
          {selectedTemplate?.name || 'Select a conversation template...'}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <button
            onClick={() => {
              onSelect(null);
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            No template (freeform)
          </button>
          {filteredTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                onSelect(template);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                selectedTemplate?.id === template.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
              }`}
            >
              <div className="font-medium text-sm text-gray-900 dark:text-white">{template.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{template.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateGuide({ template }: { template: ConversationTemplate }) {
  const [expandedSection, setExpandedSection] = useState<'opening' | 'followup' | 'actions' | null>('opening');

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        Conversation Guide: {template.name}
      </h4>

      <div className="space-y-2">
        <button
          onClick={() => setExpandedSection(expandedSection === 'opening' ? null : 'opening')}
          className="w-full flex items-center justify-between text-sm font-medium text-blue-800 dark:text-blue-200"
        >
          Opening Questions
          <svg
            className={`w-4 h-4 transition-transform ${expandedSection === 'opening' ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expandedSection === 'opening' && (
          <ul className="pl-4 space-y-1">
            {template.openingQuestions.map((q, i) => (
              <li key={i} className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <span className="text-blue-400">-</span>
                {q}
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={() => setExpandedSection(expandedSection === 'followup' ? null : 'followup')}
          className="w-full flex items-center justify-between text-sm font-medium text-blue-800 dark:text-blue-200"
        >
          Follow-up Questions
          <svg
            className={`w-4 h-4 transition-transform ${expandedSection === 'followup' ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expandedSection === 'followup' && (
          <ul className="pl-4 space-y-1">
            {template.followUpQuestions.map((q, i) => (
              <li key={i} className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <span className="text-blue-400">-</span>
                {q}
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={() => setExpandedSection(expandedSection === 'actions' ? null : 'actions')}
          className="w-full flex items-center justify-between text-sm font-medium text-blue-800 dark:text-blue-200"
        >
          Suggested Actions
          <svg
            className={`w-4 h-4 transition-transform ${expandedSection === 'actions' ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expandedSection === 'actions' && (
          <ul className="pl-4 space-y-1">
            {template.suggestedActions.map((a, i) => (
              <li key={i} className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                <span className="text-blue-400">-</span>
                {a}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ScheduleModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  zone,
  reason,
  burnoutScore,
  onSchedule,
}: ScheduleModalProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [duration, setDuration] = useState(30);
  const [calendarType, setCalendarType] = useState<'google' | 'outlook' | 'ical'>('google');
  const [selectedTemplate, setSelectedTemplate] = useState<ConversationTemplate | null>(null);

  // Fetch templates from API (with fallback)
  const { data: apiTemplates } = useQuery({
    queryKey: ['conversation-templates', zone],
    queryFn: () => interventionsApi.getTemplates(zone),
    enabled: isOpen,
  });

  const templates = apiTemplates ?? DEFAULT_TEMPLATES;

  // Fetch intervention history for this employee
  const { data: history } = useQuery({
    queryKey: ['employee-intervention-history', employeeId],
    queryFn: () => interventionsApi.getEmployeeHistory(employeeId),
    enabled: isOpen,
  });

  if (!isOpen) return null;

  // Generate suggested times (next 5 business days, common meeting times)
  const suggestedTimes: Array<{ date: string; time: string; label: string }> = [];
  const now = new Date();
  for (let i = 1; i <= 5; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      ['09:00', '10:00', '14:00', '15:00'].forEach((time) => {
        suggestedTimes.push({
          date: date.toISOString().split('T')[0],
          time,
          label: `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${time}`,
        });
      });
    }
  }

  const handleSubmit = () => {
    if (selectedDate && selectedTime) {
      const dateTime = new Date(`${selectedDate}T${selectedTime}`);
      onSchedule(dateTime, duration, selectedTemplate?.id);
    }
  };

  const generateCalendarUrl = () => {
    if (!selectedDate || !selectedTime) return '';

    const startDate = new Date(`${selectedDate}T${selectedTime}`);
    const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
    const title = encodeURIComponent(`1:1 with ${employeeName}`);
    const templateInfo = selectedTemplate ? `\n\nTemplate: ${selectedTemplate.name}` : '';
    const description = encodeURIComponent(`Check-in meeting: ${REASON_LABELS[reason] || reason}${templateInfo}`);

    if (calendarType === 'google') {
      const start = startDate.toISOString().replace(/-|:|\.\d+/g, '');
      const end = endDate.toISOString().replace(/-|:|\.\d+/g, '');
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${description}`;
    } else if (calendarType === 'outlook') {
      const start = startDate.toISOString();
      const end = endDate.toISOString();
      return `https://outlook.office.com/calendar/0/deeplink/compose?subject=${title}&startdt=${start}&enddt=${end}&body=${description}`;
    } else {
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
        'END:VCALENDAR',
      ].join('\n');
      return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Schedule 1:1 with {employeeName}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${ZONE_COLORS[zone]}`} />
              <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">{zone} zone</span>
              {burnoutScore && (
                <span className="text-sm text-gray-500 dark:text-gray-400">| Score: {burnoutScore}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-icon"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Intervention History Summary */}
        {history && history.interventions.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Past Interventions</h4>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Total: </span>
                <span className="font-medium text-gray-900 dark:text-white">{history.interventions.length}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Improvement Rate: </span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {history.improvementRate.toFixed(0)}%
                </span>
              </div>
              {history.avgDaysToImprovement && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Avg Time: </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {history.avgDaysToImprovement.toFixed(0)} days
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Conversation Template Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Conversation Template
            </label>
            <TemplateDropdown
              templates={templates}
              selectedTemplate={selectedTemplate}
              onSelect={setSelectedTemplate}
              zone={zone}
            />
          </div>

          {/* Template Guide */}
          {selectedTemplate && <TemplateGuide template={selectedTemplate} />}

          {/* Quick select times */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick Select</label>
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
                { id: 'google', label: 'Google' },
                { id: 'outlook', label: 'Outlook' },
                { id: 'ical', label: 'Download' },
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
              className="btn btn-secondary flex-1"
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
                className="btn btn-primary flex-1 text-center"
              >
                {calendarType === 'ical' ? 'Download .ics' : 'Open Calendar'}
              </a>
            ) : (
              <button
                disabled
                className="btn btn-secondary flex-1 cursor-not-allowed opacity-50"
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

function LogOutcomeModal({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  zone,
  scheduledDate,
  onLogOutcome,
}: LogOutcomeModalProps) {
  const [interventionType, setInterventionType] = useState<InterventionType>('check_in');
  const [notes, setNotes] = useState('');
  const [actionsTaken, setActionsTaken] = useState<string[]>([]);
  const [newAction, setNewAction] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch templates for suggested actions
  const { data: apiTemplates } = useQuery({
    queryKey: ['conversation-templates', zone],
    queryFn: () => interventionsApi.getTemplates(zone),
    enabled: isOpen,
  });

  const templates = apiTemplates ?? DEFAULT_TEMPLATES;
  const suggestedActions = templates.flatMap((t) => t.suggestedActions);
  const uniqueSuggestedActions = Array.from(new Set(suggestedActions));

  if (!isOpen) return null;

  const handleAddAction = () => {
    if (newAction.trim() && !actionsTaken.includes(newAction.trim())) {
      setActionsTaken([...actionsTaken, newAction.trim()]);
      setNewAction('');
    }
  };

  const handleRemoveAction = (action: string) => {
    setActionsTaken(actionsTaken.filter((a) => a !== action));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onLogOutcome({
        type: interventionType,
        notes,
        actionsTaken,
        followUpDate: followUpDate || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Log 1:1 Outcome</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Meeting with {employeeName}</p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-icon"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Intervention Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Meeting Type</label>
            <select
              value={interventionType}
              onChange={(e) => setInterventionType(e.target.value as InterventionType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {INTERVENTION_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Meeting Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Key discussion points, concerns raised, agreements made..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400"
            />
          </div>

          {/* Actions Taken */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Actions Taken</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAction()}
                placeholder="Add an action..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
              <button
                onClick={handleAddAction}
                className="btn btn-primary text-sm"
              >
                Add
              </button>
            </div>

            {/* Suggested Actions */}
            {uniqueSuggestedActions.length > 0 && actionsTaken.length < 5 && (
              <div className="mb-2">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Suggested:</p>
                <div className="flex flex-wrap gap-1">
                  {uniqueSuggestedActions
                    .filter((a) => !actionsTaken.includes(a))
                    .slice(0, 4)
                    .map((action) => (
                      <button
                        key={action}
                        onClick={() => setActionsTaken([...actionsTaken, action])}
                        className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        + {action}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Selected Actions */}
            {actionsTaken.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {actionsTaken.map((action) => (
                  <span
                    key={action}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs"
                  >
                    {action}
                    <button onClick={() => handleRemoveAction(action)} className="hover:text-emerald-900">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Follow-up Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Schedule Follow-up (optional)
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="btn btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn btn-primary flex-1"
            >
              {isSubmitting ? 'Saving...' : 'Log Outcome'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MeetingSuggestions() {
  const queryClient = useQueryClient();
  const [scheduledMeetings, setScheduledMeetings] = useState<
    Map<string, { date: Date; templateId?: string }>
  >(new Map());
  const [scheduleModalData, setScheduleModalData] = useState<{
    employeeId: string;
    employeeName: string;
    zone: Zone;
    reason: string;
    burnoutScore?: number;
  } | null>(null);
  const [outcomeModalData, setOutcomeModalData] = useState<{
    employeeId: string;
    employeeName: string;
    zone: Zone;
    scheduledDate?: Date;
  } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['meeting-suggestions'],
    queryFn: fetchMeetingSuggestions,
  });

  const { data: recentInterventions = [] } = useQuery({
    queryKey: ['recent-interventions'],
    queryFn: () => interventionsApi.getAll({ limit: 5, includeOutcomes: true }),
    enabled: showHistory,
  });

  const createInterventionMutation = useMutation({
    mutationFn: interventionsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      queryClient.invalidateQueries({ queryKey: ['recent-interventions'] });
      queryClient.invalidateQueries({ queryKey: ['intervention-stats'] });
    },
  });

  const handleOpenScheduleModal = (
    employeeId: string,
    employeeName: string,
    zone: Zone,
    reason: string,
    burnoutScore?: number
  ) => {
    setScheduleModalData({ employeeId, employeeName, zone, reason, burnoutScore });
  };

  const handleScheduleComplete = (dateTime: Date, duration: number, templateId?: string) => {
    if (scheduleModalData) {
      setScheduledMeetings((prev) => {
        const newMap = new Map(prev);
        newMap.set(scheduleModalData.employeeId, { date: dateTime, templateId });
        return newMap;
      });
    }
    setScheduleModalData(null);
  };

  const handleOpenOutcomeModal = (employeeId: string, employeeName: string, zone: Zone) => {
    const scheduled = scheduledMeetings.get(employeeId);
    setOutcomeModalData({
      employeeId,
      employeeName,
      zone,
      scheduledDate: scheduled?.date,
    });
  };

  const handleLogOutcome = async (data: {
    type: InterventionType;
    notes: string;
    actionsTaken: string[];
    followUpDate?: string;
    templateUsed?: string;
  }) => {
    if (outcomeModalData) {
      const scheduled = scheduledMeetings.get(outcomeModalData.employeeId);
      await createInterventionMutation.mutateAsync({
        employeeId: outcomeModalData.employeeId,
        type: data.type,
        meetingDate: (scheduled?.date || new Date()).toISOString(),
        notes: data.notes || undefined,
        templateUsed: scheduled?.templateId || data.templateUsed,
        actionsTaken: data.actionsTaken,
        followUpDate: data.followUpDate,
      });
    }
    setOutcomeModalData(null);
  };

  if (isLoading) {
    return (
      <div className="card animate-pulse h-full">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          ))}
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
    <div className="card h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">1:1 Meeting Suggestions</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`text-xs px-2 py-1 rounded-full transition-colors ${
              showHistory
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {showHistory ? 'Hide History' : 'View History'}
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
            {suggestions.length} suggested
          </span>
        </div>
      </div>

      {/* Recent Interventions History */}
      {showHistory && (
        <div className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recent 1:1s</h3>
          {recentInterventions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No recent interventions recorded.</p>
          ) : (
            <div className="space-y-2">
              {recentInterventions.map((intervention) => (
                <div
                  key={intervention.id}
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm"
                >
                  <span className={`w-2 h-2 rounded-full ${ZONE_COLORS[intervention.zoneBefore]}`} />
                  <span className="font-medium text-gray-900 dark:text-white">{intervention.employeeName}</span>
                  <span className="text-gray-500 dark:text-gray-400">-</span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {new Date(intervention.meetingDate).toLocaleDateString()}
                  </span>
                  {intervention.outcome && (
                    <span
                      className={`ml-auto px-2 py-0.5 text-xs rounded-full ${
                        intervention.outcome.status === 'improved'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                          : intervention.outcome.status === 'declined'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {intervention.outcome.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {suggestions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No meeting suggestions at this time.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedSuggestions.map((suggestion) => {
            const urgencyStyle = URGENCY_STYLES[suggestion.urgency];
            const zoneColor = ZONE_COLORS[suggestion.zone];
            const reasonLabel = REASON_LABELS[suggestion.reason] || suggestion.reason;
            const isScheduled = scheduledMeetings.has(suggestion.employeeId);

            return (
              <div
                key={suggestion.employeeId}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="relative">
                  <Avatar name={suggestion.employeeName} size="sm" />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${zoneColor}`}
                  ></span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {suggestion.employeeName}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{reasonLabel}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${urgencyStyle.bg} ${urgencyStyle.text}`}>
                    {suggestion.urgency}
                  </span>
                  <div className="flex items-center gap-2">
                    {isScheduled ? (
                      <>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Scheduled
                        </span>
                        <button
                          onClick={() =>
                            handleOpenOutcomeModal(suggestion.employeeId, suggestion.employeeName, suggestion.zone)
                          }
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          Log Outcome
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() =>
                          handleOpenScheduleModal(
                            suggestion.employeeId,
                            suggestion.employeeName,
                            suggestion.zone,
                            suggestion.reason,
                            suggestion.burnoutScore
                          )
                        }
                        className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                      >
                        Schedule
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Modal */}
      {scheduleModalData && (
        <ScheduleModal
          isOpen={true}
          onClose={() => setScheduleModalData(null)}
          employeeId={scheduleModalData.employeeId}
          employeeName={scheduleModalData.employeeName}
          zone={scheduleModalData.zone}
          reason={scheduleModalData.reason}
          burnoutScore={scheduleModalData.burnoutScore}
          onSchedule={handleScheduleComplete}
        />
      )}

      {/* Log Outcome Modal */}
      {outcomeModalData && (
        <LogOutcomeModal
          isOpen={true}
          onClose={() => setOutcomeModalData(null)}
          employeeId={outcomeModalData.employeeId}
          employeeName={outcomeModalData.employeeName}
          zone={outcomeModalData.zone}
          scheduledDate={outcomeModalData.scheduledDate}
          onLogOutcome={handleLogOutcome}
        />
      )}
    </div>
  );
}

export default MeetingSuggestions;
