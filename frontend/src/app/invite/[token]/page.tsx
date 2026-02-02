'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { authApi } from '@/lib/api';
import type { InvitationDetails } from '@/types';
import { LogoFull } from '@/components/Logo';

type InvitationError = 'expired' | 'revoked' | 'already_accepted' | 'not_found' | 'unknown';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default function AcceptInvitationPage({ params }: PageProps) {
  const { token } = use(params);
  const { acceptInvitation } = useAuth();

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<InvitationError | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Fetch invitation details on mount
  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const details = await authApi.getInvitation(token);
        setInvitation(details);
        // Pre-fill name fields if provided in invitation
        if (details.firstName || details.lastName) {
          setFormData((prev) => ({
            ...prev,
            firstName: details.firstName || '',
            lastName: details.lastName || '',
          }));
        }
      } catch (err: any) {
        const message = err.response?.data?.message || err.message || '';
        const status = err.response?.status || err.status;

        if (status === 404 || message.toLowerCase().includes('not found')) {
          setError('not_found');
          setErrorMessage('This invitation link is invalid or does not exist.');
        } else if (message.toLowerCase().includes('expired')) {
          setError('expired');
          setErrorMessage('This invitation has expired. Please contact your administrator for a new invitation.');
        } else if (message.toLowerCase().includes('revoked')) {
          setError('revoked');
          setErrorMessage('This invitation has been revoked. Please contact your administrator.');
        } else if (message.toLowerCase().includes('already') || message.toLowerCase().includes('accepted')) {
          setError('already_accepted');
          setErrorMessage('This invitation has already been accepted. You can sign in with your account.');
        } else {
          setError('unknown');
          setErrorMessage(message || 'Unable to load invitation details. Please try again later.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvitation();
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validate password
    if (formData.password.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      await acceptInvitation({
        token,
        password: formData.password,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
      });
      // acceptInvitation handles redirect to /onboarding
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Failed to accept invitation';

      if (message.toLowerCase().includes('expired')) {
        setFormError('This invitation has expired. Please contact your administrator for a new invitation.');
      } else if (message.toLowerCase().includes('revoked')) {
        setFormError('This invitation has been revoked. Please contact your administrator.');
      } else if (message.toLowerCase().includes('already')) {
        setFormError('This invitation has already been accepted. Please sign in instead.');
      } else {
        setFormError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format role for display
  const formatRole = (role: string) => {
    return role.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-4"><LogoFull /></div>
            <div className="flex items-center justify-center gap-3">
              <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-gray-600 dark:text-gray-400">Loading invitation...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="flex justify-center mb-4"><LogoFull /></div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {error === 'expired' && 'Invitation Expired'}
              {error === 'revoked' && 'Invitation Revoked'}
              {error === 'already_accepted' && 'Already Accepted'}
              {error === 'not_found' && 'Invalid Invitation'}
              {error === 'unknown' && 'Something Went Wrong'}
            </h1>
          </div>

          <div className="card">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {errorMessage}
              </p>

              <div className="space-y-3">
                {error === 'already_accepted' ? (
                  <Link href="/login" className="btn btn-primary w-full block text-center">
                    Sign In
                  </Link>
                ) : (
                  <Link href="/login" className="btn btn-primary w-full block text-center">
                    Go to Login
                  </Link>
                )}

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Need help?{' '}
                  <a href="mailto:support@shepherd.app" className="text-indigo-600 hover:text-indigo-500 font-medium">
                    Contact Support
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state - show invitation details and form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {invitation?.organizationLogo ? (
            <img src={invitation.organizationLogo} alt={invitation.organizationName} className="h-16 w-auto mx-auto mb-4" />
          ) : (
            <div className="flex justify-center mb-4"><LogoFull /></div>
          )}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Join {invitation?.organizationName}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            You have been invited to join the team
          </p>
        </div>

        <div className="card">
          {/* Invitation Details */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              Invitation Details
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Email:</dt>
                <dd className="text-gray-900 dark:text-white font-medium">{invitation?.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Role:</dt>
                <dd className="text-gray-900 dark:text-white font-medium">{formatRole(invitation?.role || 'employee')}</dd>
              </div>
              {invitation?.departmentName && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Department:</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">{invitation.departmentName}</dd>
                </div>
              )}
              {invitation?.jobTitle && (
                <div className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Job Title:</dt>
                  <dd className="text-gray-900 dark:text-white font-medium">{invitation.jobTitle}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Accept Invitation Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            {formError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formError}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="label">
                  First Name
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleChange}
                  className="input"
                  placeholder="John"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="label">
                  Last Name
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleChange}
                  className="input"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">
                Create Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleChange}
                className="input"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="input"
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Accepting Invitation...
                </span>
              ) : (
                'Accept Invitation & Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
