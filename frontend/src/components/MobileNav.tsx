'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { LayoutDashboard, Heart, User, Palette, Link2, Settings, X, Menu, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Avatar } from './Avatar';
import { ThemeToggle } from './ThemeToggle';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  // Prevent scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on route change
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  const isManager = user?.role === 'manager';
  const displayName = user?.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`
    : user?.email;

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/wellness', label: 'Wellness', icon: Heart },
    ...(isManager ? [] : [{ href: '/profile', label: 'My Profile', icon: User }]),
    ...(isManager ? [] : [{ href: '/settings/personalization', label: 'Personalization', icon: Palette }]),
    ...(isManager ? [] : [{ href: '/onboarding', label: 'Connections', icon: Link2 }]),
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 backdrop-blur-modal"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 shadow-xl mobile-menu-enter">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <Link href="/dashboard" className="flex items-center gap-2" onClick={onClose}>
              <img src="/logo.svg" alt="Herd Shepherd" className="h-8 w-auto" />
              <span className="font-bold text-gray-900 dark:text-white">Herd Shepherd</span>
            </Link>
            <button
              onClick={onClose}
              className="btn-icon"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Avatar
                src={user?.profilePictureUrl}
                name={displayName || ''}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {displayName}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                  {user?.role}
                </p>
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={clsx(
                        'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                        pathname === link.href
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Theme</span>
              <ThemeToggle />
            </div>
            <button
              onClick={() => {
                onClose();
                logout();
              }}
              className="w-full btn btn-ghost text-red-600 dark:text-red-400 justify-center"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Hamburger Button
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden btn-icon"
      aria-label="Open menu"
    >
      <Menu className="w-6 h-6" />
    </button>
  );
}
