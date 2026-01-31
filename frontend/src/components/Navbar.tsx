'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { LayoutDashboard, Heart, Settings, ChevronDown, TrendingUp, BarChart3, Users, Calendar } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { alertsApi } from '@/lib/api';
import { Avatar } from './Avatar';
import { ThemeToggle } from './ThemeToggle';
import { MobileNav, MobileMenuButton } from './MobileNav';
import { DataFreshnessIndicator } from './DataFreshness';

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const closeMobileMenu = useCallback(() => setShowMobileMenu(false), []);

  const { data: alerts } = useQuery({
    queryKey: ['alerts', { acknowledged: false }],
    queryFn: () => alertsApi.getAll({ acknowledged: false, limit: 10 }),
    refetchInterval: 30000,
  });

  const unacknowledgedCount = alerts?.filter((a) => !a.isAcknowledged).length || 0;
  const isManager = user?.role === 'manager';
  const displayName = user?.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`
    : user?.email;

  return (
    <>
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left side */}
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <MobileMenuButton onClick={() => setShowMobileMenu(true)} />

              {/* Logo */}
              <Link href="/dashboard" className="flex items-center gap-2">
                <img src="/logo.svg" alt="ShepHerd" className="h-8 w-auto" />
                <span className="font-bold text-gray-900 dark:text-white hidden sm:inline">
                  ShepHerd
                </span>
              </Link>

              {/* Desktop Nav Links */}
              <div className="hidden md:flex items-center gap-1 ml-4">
                <NavLink href="/dashboard" active={pathname === '/dashboard'} icon={<LayoutDashboard className="w-4 h-4" />}>
                  Dashboard
                </NavLink>
                {!isManager ? (
                  <>
                    <NavLink href="/dashboard/insights" active={pathname === '/dashboard/insights'} icon={<TrendingUp className="w-4 h-4" />}>
                      Insights
                    </NavLink>
                    <NavLink href="/dashboard/metrics" active={pathname === '/dashboard/metrics'} icon={<BarChart3 className="w-4 h-4" />}>
                      Metrics
                    </NavLink>
                  </>
                ) : (
                  <>
                    <NavLink href="/dashboard/team" active={pathname === '/dashboard/team'} icon={<Users className="w-4 h-4" />}>
                      Team
                    </NavLink>
                    <NavLink href="/dashboard/analytics" active={pathname === '/dashboard/analytics'} icon={<BarChart3 className="w-4 h-4" />}>
                      Analytics
                    </NavLink>
                    <NavLink href="/dashboard/meetings" active={pathname === '/dashboard/meetings'} icon={<Calendar className="w-4 h-4" />}>
                      Meetings
                    </NavLink>
                  </>
                )}
                {!isManager && (
                  <NavLink href="/wellness" active={pathname === '/wellness'} icon={<Heart className="w-4 h-4" />}>
                    Wellness
                  </NavLink>
                )}
                <NavLink href="/settings" active={pathname === '/settings'} icon={<Settings className="w-4 h-4" />}>
                  Settings
                </NavLink>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Data Freshness Indicator - Only for employees */}
              {!isManager && (
                <div className="hidden sm:block">
                  <DataFreshnessIndicator />
                </div>
              )}

              {/* Alert Badge */}
              {unacknowledgedCount > 0 && (
                <div className="hidden sm:block">
                  <span className="badge-red flex items-center gap-1.5 px-3 py-1">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    {unacknowledgedCount} alert{unacknowledgedCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Mobile alert indicator */}
              {unacknowledgedCount > 0 && (
                <div className="sm:hidden relative">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
                    {unacknowledgedCount}
                  </span>
                </div>
              )}

              {/* Theme Toggle - Desktop */}
              <div className="hidden md:block">
                <ThemeToggle />
              </div>

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Avatar
                    src={user?.profilePictureUrl}
                    name={displayName || ''}
                    size="sm"
                  />
                  <span className="hidden lg:block text-sm text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 hidden sm:block" />
                </button>

                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="dropdown-menu animate-scale-in">
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          <Avatar
                            src={user?.profilePictureUrl}
                            name={displayName || ''}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {displayName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                              {user?.role}
                            </p>
                          </div>
                        </div>
                      </div>
                      {!isManager && (
                        <>
                          <Link
                            href="/profile"
                            className="dropdown-item"
                            onClick={() => setShowUserMenu(false)}
                          >
                            My Profile
                          </Link>
                          <Link
                            href="/settings/personalization"
                            className="dropdown-item"
                            onClick={() => setShowUserMenu(false)}
                          >
                            Personalization
                          </Link>
                        </>
                      )}
                      <Link
                        href="/settings"
                        className="dropdown-item"
                        onClick={() => setShowUserMenu(false)}
                      >
                        Settings
                      </Link>
                      <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            logout();
                          }}
                          className="dropdown-item-danger"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <MobileNav isOpen={showMobileMenu} onClose={closeMobileMenu} />
    </>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
        active
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shadow-sm'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
