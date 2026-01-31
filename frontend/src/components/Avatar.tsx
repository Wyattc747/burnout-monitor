'use client';

import { clsx } from 'clsx';
import type { Zone } from '@/types';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  zone?: Zone;
}

const zoneRingClasses = {
  red: 'ring-2 ring-red-500 ring-offset-2 dark:ring-offset-gray-900',
  yellow: 'ring-2 ring-yellow-500 ring-offset-2 dark:ring-offset-gray-900',
  green: 'ring-2 ring-green-500 ring-offset-2 dark:ring-offset-gray-900',
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function Avatar({ src, name = '', size = 'md', className, zone }: AvatarProps) {
  const zoneRing = zone ? zoneRingClasses[zone] : '';
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  };

  // Get initials from name
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate a consistent color based on name
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-orange-500',
    'bg-red-500',
  ];
  const colorIndex = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  const bgColor = colors[colorIndex];

  // Build full image URL
  const imageUrl = src ? (src.startsWith('http') ? src : `${API_URL}${src}`) : null;

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={clsx(
          'rounded-full object-cover transition-shadow duration-200',
          sizeClasses[size],
          zoneRing,
          className
        )}
      />
    );
  }

  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center text-white font-medium transition-shadow duration-200',
        sizeClasses[size],
        bgColor,
        zoneRing,
        className
      )}
    >
      {initials || '?'}
    </div>
  );
}
