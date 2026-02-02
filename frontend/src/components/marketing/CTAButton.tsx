'use client';

import Link from 'next/link';
import { clsx } from 'clsx';

type CTAButtonVariant = 'primary' | 'secondary' | 'outline';
type CTAButtonSize = 'sm' | 'md' | 'lg';

interface CTAButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: CTAButtonVariant;
  size?: CTAButtonSize;
  className?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit';
}

const variantStyles: Record<CTAButtonVariant, string> = {
  primary:
    'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40',
  secondary:
    'bg-white text-gray-900 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 shadow-lg',
  outline:
    'bg-transparent border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-400 dark:text-emerald-400 dark:hover:bg-emerald-900/20',
};

const sizeStyles: Record<CTAButtonSize, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3 text-base',
  lg: 'px-8 py-4 text-lg',
};

export function CTAButton({
  children,
  href,
  onClick,
  variant = 'primary',
  size = 'md',
  className,
  disabled = false,
  fullWidth = false,
  type = 'button',
}: CTAButtonProps) {
  const baseStyles = clsx(
    'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'active:scale-[0.98]',
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && 'w-full',
    className
  );

  if (href) {
    return (
      <Link href={href} className={baseStyles}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={baseStyles}
    >
      {children}
    </button>
  );
}
