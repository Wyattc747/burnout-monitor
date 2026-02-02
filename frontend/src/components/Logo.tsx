'use client';

import Image from 'next/image';
import Link from 'next/link';
import { clsx } from 'clsx';

interface LogoProps {
  variant?: 'full' | 'icon' | 'text';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  href?: string;
  dark?: boolean;
}

// Logo sizes in pixels
const sizes = {
  sm: { height: 24, iconSize: 24 },
  md: { height: 32, iconSize: 32 },
  lg: { height: 40, iconSize: 40 },
  xl: { height: 56, iconSize: 56 },
};

export function Logo({
  variant = 'full',
  size = 'md',
  className,
  href,
  dark = false,
}: LogoProps) {
  const { height, iconSize } = sizes[size];

  const content = (
    <div className={clsx('flex items-center gap-2', className)}>
      {(variant === 'full' || variant === 'icon') && (
        <div className="relative" style={{ height: iconSize, width: iconSize * 2 }}>
          {/* Use the PNG logo if available, fallback to SVG */}
          <Image
            src="/logo.png"
            alt="ShepHerd"
            width={iconSize * 2}
            height={iconSize}
            className="object-contain"
            onError={(e) => {
              // Fallback to SVG if PNG doesn't exist
              (e.target as HTMLImageElement).src = '/logo.svg';
            }}
          />
        </div>
      )}
      {(variant === 'full' || variant === 'text') && (
        <span
          className={clsx(
            'font-bold tracking-tight',
            dark ? 'text-white' : 'text-gray-900 dark:text-white',
            size === 'sm' && 'text-lg',
            size === 'md' && 'text-xl',
            size === 'lg' && 'text-2xl',
            size === 'xl' && 'text-3xl'
          )}
        >
          ShepHerd
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}

// Separate icon-only logo using SVG for the sidebar/favicon use cases
export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 60 60"
      fill="none"
      width={size}
      height={size}
      className={className}
    >
      {/* Single elephant icon */}
      <g transform="translate(5, 8)">
        {/* Body */}
        <ellipse cx="22" cy="28" rx="20" ry="16" fill="#6366F1"/>
        {/* Head */}
        <circle cx="42" cy="20" r="12" fill="#6366F1"/>
        {/* Ear */}
        <ellipse cx="46" cy="14" rx="7" ry="10" fill="#818CF8"/>
        {/* Trunk */}
        <path d="M52 26 Q58 34 56 46 Q54 48 52 46 Q48 38 48 30" fill="#6366F1" stroke="#6366F1" strokeWidth="1"/>
        {/* Legs */}
        <rect x="8" y="40" width="6" height="16" rx="3" fill="#6366F1"/>
        <rect x="20" y="40" width="6" height="16" rx="3" fill="#6366F1"/>
        <rect x="30" y="40" width="6" height="16" rx="3" fill="#6366F1"/>
        <rect x="40" y="36" width="6" height="14" rx="3" fill="#6366F1"/>
        {/* Eye */}
        <circle cx="46" cy="18" r="2" fill="white"/>
      </g>
    </svg>
  );
}

// Full horizontal logo with elephants + text for headers
export function LogoFull({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt="ShepHerd"
        className="h-10 w-auto object-contain"
      />
      <span className={clsx(
        'text-xl font-bold tracking-tight',
        dark ? 'text-white' : 'text-gray-900 dark:text-white'
      )}>
        ShepHerd
      </span>
    </div>
  );
}
