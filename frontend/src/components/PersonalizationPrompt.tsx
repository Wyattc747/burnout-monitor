'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { personalizationApi } from '@/lib/api';

export function PersonalizationPrompt() {
  const [dismissed, setDismissed] = useState(false);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['personalization', 'summary'],
    queryFn: personalizationApi.getSummary,
  });

  // Don't show if loading, dismissed, or setup is complete
  if (isLoading || dismissed || !summary?.needsSetup) {
    return null;
  }

  return (
    <div className="card border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 animate-slide-up">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <span className="text-3xl">✨</span>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
            Personalize Your Experience
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Help us understand what works best for you. We'll use this to provide more accurate
            wellness insights tailored to your unique needs.
          </p>
          <div className="flex gap-3">
            <Link href="/settings/personalization" className="btn btn-primary text-sm">
              Set Up Now
            </Link>
            <button
              onClick={() => setDismissed(true)}
              className="btn btn-ghost text-sm"
            >
              Maybe Later
            </button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
