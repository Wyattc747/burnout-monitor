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
    bg: 'zone-gradient-red',
    text: 'text-red-700 dark:text-red-400',
    label: 'Burnout Risk',
    pulse: 'zone-pulse-red',
    ring: 'zone-ring-red',
  },
  yellow: {
    bg: 'zone-gradient-yellow',
    text: 'text-yellow-700 dark:text-yellow-400',
    label: 'Moderate',
    pulse: '',
    ring: 'zone-ring-yellow',
  },
  green: {
    bg: 'zone-gradient-green',
    text: 'text-green-700 dark:text-green-400',
    label: 'Peak Ready',
    pulse: 'zone-pulse-green',
    ring: 'zone-ring-green',
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
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide shadow-sm transition-all duration-200 hover:shadow-md',
        zone === 'red' && 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        zone === 'yellow' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        zone === 'green' && 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
      )}
    >
      <span className={clsx('w-2.5 h-2.5 rounded-full shadow-inner', config.bg)} />
      {config.label}
    </span>
  );
}

// Export zone ring class getter for use with Avatar
export function getZoneRingClass(zone: Zone): string {
  return zoneConfig[zone].ring;
}
