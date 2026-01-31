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

export function ZoneBadge({ zone, size = 'md' }: { zone: Zone; size?: 'sm' | 'md' | 'lg' }) {
  const config = zoneConfig[zone];

  const sizeClasses = {
    sm: { badge: 'px-2 py-1 text-xs gap-1', dot: 'w-2 h-2' },
    md: { badge: 'px-3 py-1.5 text-xs gap-1.5', dot: 'w-2.5 h-2.5' },
    lg: { badge: 'px-4 py-2 text-sm gap-2', dot: 'w-3 h-3' },
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-semibold tracking-wide shadow-sm transition-all duration-200 hover:shadow-md',
        sizeClasses[size].badge,
        zone === 'red' && 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
        zone === 'yellow' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
        zone === 'green' && 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
      )}
    >
      <span className={clsx('rounded-full shadow-inner', sizeClasses[size].dot, config.bg)} />
      {config.label}
    </span>
  );
}

// Export zone ring class getter for use with Avatar
export function getZoneRingClass(zone: Zone): string {
  return zoneConfig[zone].ring;
}
