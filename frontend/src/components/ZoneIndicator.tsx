'use client';

import { clsx } from 'clsx';
import type { Zone } from '@/types';

interface ZoneIndicatorProps {
  zone: Zone;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
}

const zoneConfig = {
  red: {
    bg: 'bg-red-500',
    text: 'text-red-700',
    label: 'Burnout Risk',
    pulse: 'zone-pulse-red',
  },
  yellow: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-700',
    label: 'Moderate',
    pulse: '',
  },
  green: {
    bg: 'bg-green-500',
    text: 'text-green-700',
    label: 'Peak Ready',
    pulse: 'zone-pulse-green',
  },
};

const sizeConfig = {
  sm: { dot: 'w-3 h-3', text: 'text-xs' },
  md: { dot: 'w-4 h-4', text: 'text-sm' },
  lg: { dot: 'w-6 h-6', text: 'text-base' },
};

export function ZoneIndicator({
  zone,
  size = 'md',
  showLabel = false,
  animated = false,
}: ZoneIndicatorProps) {
  const config = zoneConfig[zone];
  const sizeStyles = sizeConfig[size];

  return (
    <div className="flex items-center gap-2">
      <div
        className={clsx(
          'rounded-full',
          config.bg,
          sizeStyles.dot,
          animated && config.pulse
        )}
      />
      {showLabel && (
        <span className={clsx('font-medium', config.text, sizeStyles.text)}>
          {config.label}
        </span>
      )}
    </div>
  );
}

export function ZoneBadge({ zone }: { zone: Zone }) {
  const config = zoneConfig[zone];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        zone === 'red' && 'bg-red-100 text-red-800',
        zone === 'yellow' && 'bg-yellow-100 text-yellow-800',
        zone === 'green' && 'bg-green-100 text-green-800'
      )}
    >
      <span className={clsx('w-2 h-2 rounded-full', config.bg)} />
      {config.label}
    </span>
  );
}
