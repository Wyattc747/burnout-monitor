'use client';

import Link from 'next/link';
import { useState } from 'react';

// Feature category type
interface Feature {
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface FeatureCategory {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  gradient: string;
  iconBg: string;
  features: Feature[];
}

// Health Monitoring Icon
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );
}

// Work Analytics Icon
function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

// AI Icon
function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

// Manager Tools Icon
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

// Automation Badge
function AutoBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
      Automated
    </span>
  );
}

// Feature categories data
const featureCategories: FeatureCategory[] = [
  {
    id: 'health',
    title: 'Health Monitoring',
    subtitle: 'Automated biometric tracking',
    description: 'Seamlessly sync with popular wearable devices to capture comprehensive health data without manual input.',
    gradient: 'from-rose-500 to-pink-600',
    iconBg: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
    features: [
      {
        title: 'Wearable Device Sync',
        description: 'Automatic data sync with Apple Watch, Fitbit, Garmin, and Oura Ring. Real-time health metrics flow seamlessly into ShepHerd.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        title: 'Sleep Tracking & Quality Analysis',
        description: 'Comprehensive sleep pattern analysis including duration, quality stages, and consistency. Identify sleep deficits before they impact performance.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        ),
      },
      {
        title: 'Heart Rate Variability Monitoring',
        description: 'Track HRV patterns as a key indicator of stress and recovery. Early warning system for physiological stress accumulation.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        ),
      },
      {
        title: 'Exercise & Activity Tracking',
        description: 'Monitor daily movement, workout frequency, and recovery patterns. Balance between activity and rest for optimal wellness.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
      },
    ],
  },
  {
    id: 'work',
    title: 'Work Analytics',
    subtitle: 'Automated workplace insights',
    description: 'Intelligent analysis of work patterns to identify stressors, optimize productivity, and maintain healthy boundaries.',
    gradient: 'from-blue-500 to-cyan-600',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    features: [
      {
        title: 'Calendar Integration',
        description: 'Automatic sync with Google Calendar and Outlook. Track meeting load, back-to-back sessions, and focus time availability.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        title: 'Email Pattern Analysis',
        description: 'Smart analysis of email volume, response times, and after-hours activity. Identify communication overload patterns.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        title: 'Work Hours Tracking',
        description: 'Monitor actual work hours, overtime patterns, and weekend activity. Protect work-life balance with automated boundary detection.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        title: 'Task Completion Monitoring',
        description: 'Integration with project management tools to track workload distribution, deadline pressure, and task completion rates.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
    ],
  },
  {
    id: 'ai',
    title: 'AI-Powered Features',
    subtitle: 'Intelligent automation',
    description: 'Advanced machine learning algorithms that transform raw data into actionable insights and personalized recommendations.',
    gradient: 'from-violet-500 to-purple-600',
    iconBg: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    features: [
      {
        title: 'Burnout Risk Scoring',
        description: 'Proprietary algorithm that weighs multiple factors to calculate a comprehensive burnout risk score. Updated in real-time as new data flows in.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        title: 'Zone Classification',
        description: 'Automatic categorization into Green (Peak), Yellow (Moderate), or Red (At Risk) zones. Visual status at a glance for individuals and teams.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
        ),
      },
      {
        title: 'Predictive Alerts',
        description: 'Get notified before burnout happens. AI detects early warning patterns and triggers proactive alerts days or weeks in advance.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        ),
      },
      {
        title: 'Pattern Detection & Insights',
        description: 'Discover hidden patterns in behavior and wellness data. Understand what triggers stress and what promotes recovery.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        ),
      },
      {
        title: 'Personalized Recommendations',
        description: 'AI-curated wellness recommendations based on individual patterns, preferences, and current state. Actionable guidance tailored to each person.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        ),
      },
      {
        title: 'AI Wellness Mentor (Shepherd Chat)',
        description: 'Conversational AI coach available 24/7. Ask questions, get guidance, and receive personalized wellness support anytime.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        ),
      },
    ],
  },
  {
    id: 'manager',
    title: 'Manager Tools',
    subtitle: 'Automated team wellness',
    description: 'Powerful tools that give managers visibility into team wellness while respecting individual privacy through aggregation and anonymization.',
    gradient: 'from-amber-500 to-orange-600',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    features: [
      {
        title: 'Team Wellness Heatmaps',
        description: 'Visual overview of team wellness over time. Quickly identify trends, spot at-risk periods, and track improvement across your team.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
          </svg>
        ),
      },
      {
        title: '1:1 Meeting Suggestions',
        description: 'AI-powered recommendations for when to schedule check-ins based on team member wellness. Prioritized by urgency with conversation templates.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
      {
        title: 'Intervention Effectiveness Tracking',
        description: 'Measure the impact of your wellness initiatives. Track outcomes, identify what works, and continuously improve your approach.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        title: 'Anonymous Team Analytics',
        description: 'Aggregate wellness metrics that protect individual privacy while providing valuable team-level insights. Trends without exposure.',
        icon: (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
    ],
  },
];

// Feature Card Component
function FeatureCard({ feature, iconBg }: { feature: Feature; iconBg: string }) {
  return (
    <div className="group relative bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200/80 dark:border-gray-700/80 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300 hover:-translate-y-1">
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center transition-transform group-hover:scale-110`}>
          {feature.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {feature.title}
            </h3>
            <AutoBadge />
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            {feature.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// Category Section Component
function CategorySection({ category, index }: { category: FeatureCategory; index: number }) {
  const isEven = index % 2 === 0;

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Category Header */}
        <div className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-8 lg:gap-16 mb-12`}>
          {/* Icon and Title */}
          <div className="flex-shrink-0 text-center lg:text-left">
            <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${category.gradient} shadow-lg mb-4`}>
              {category.id === 'health' && <HeartIcon className="w-10 h-10 text-white" />}
              {category.id === 'work' && <ChartIcon className="w-10 h-10 text-white" />}
              {category.id === 'ai' && <SparklesIcon className="w-10 h-10 text-white" />}
              {category.id === 'manager' && <UsersIcon className="w-10 h-10 text-white" />}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {category.title}
            </h2>
            <p className="text-lg text-emerald-600 dark:text-emerald-400 font-medium">
              {category.subtitle}
            </p>
          </div>

          {/* Description */}
          <div className="flex-1 max-w-xl">
            <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
              {category.description}
            </p>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {category.features.map((feature, i) => (
            <FeatureCard key={i} feature={feature} iconBg={category.iconBg} />
          ))}
        </div>
      </div>
    </section>
  );
}

// Navigation Tabs
function CategoryNav({
  activeCategory,
  onCategoryChange
}: {
  activeCategory: string;
  onCategoryChange: (id: string) => void;
}) {
  return (
    <div className="sticky top-16 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-2 py-3 overflow-x-auto scrollbar-hide">
          {featureCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                onCategoryChange(cat.id);
                document.getElementById(cat.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {cat.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  const [activeCategory, setActiveCategory] = useState('health');

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-900 dark:to-emerald-950 pt-16 pb-8">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-[0.03] dark:opacity-[0.02]" />

        {/* Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-400/20 dark:bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              All features fully automated
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Everything You Need to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
              Prevent Burnout
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed">
            ShepHerd combines wearable health data, work analytics, and AI-powered insights to automatically
            detect burnout risks and guide your team to peak performance.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { value: '20+', label: 'Automated Metrics' },
              { value: '4', label: 'Wearable Integrations' },
              { value: '24/7', label: 'AI Monitoring' },
              { value: '100%', label: 'Hands-free' },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200/80 dark:border-gray-700/80">
                <div className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400">{stat.value}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Navigation */}
      <CategoryNav activeCategory={activeCategory} onCategoryChange={setActiveCategory} />

      {/* Feature Categories */}
      <div className="bg-gray-50 dark:bg-gray-900">
        {featureCategories.map((category, index) => (
          <div
            key={category.id}
            id={category.id}
            className={index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-950'}
          >
            <CategorySection category={category} index={index} />
          </div>
        ))}
      </div>

      {/* Integration Showcase */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-gray-900 to-gray-800 dark:from-gray-950 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Seamless Integrations
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-12">
            ShepHerd connects with the tools you already use, making setup effortless and data flow automatic.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6">
            {[
              { name: 'Apple Watch', icon: 'AppleWatch' },
              { name: 'Fitbit', icon: 'Fitbit' },
              { name: 'Garmin', icon: 'Garmin' },
              { name: 'Oura Ring', icon: 'Oura' },
              { name: 'Google Cal', icon: 'Google' },
              { name: 'Outlook', icon: 'Outlook' },
              { name: 'Slack', icon: 'Slack' },
              { name: 'Teams', icon: 'Teams' },
            ].map((integration, i) => (
              <div
                key={i}
                className="bg-gray-800/50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 hover:border-emerald-500/50 transition-colors group"
              >
                <div className="w-12 h-12 mx-auto mb-2 bg-gray-700 dark:bg-gray-800 rounded-lg flex items-center justify-center group-hover:bg-emerald-600/20 transition-colors">
                  <svg className="w-6 h-6 text-gray-400 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400 group-hover:text-white transition-colors">{integration.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
            Ready to protect your team from burnout?
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Join forward-thinking organizations that are proactively monitoring wellness
            and building healthier, more resilient teams.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="btn bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 px-8 py-3 text-lg"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="btn bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 px-8 py-3 text-lg"
            >
              View Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
