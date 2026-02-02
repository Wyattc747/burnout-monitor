'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { FormInput, validateEmail } from '@/components/FormInput';
import { LogoFull } from '@/components/Logo';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateField = (field: 'email' | 'password', value: string) => {
    let error: string | undefined;
    if (field === 'email') {
      error = validateEmail(value);
    } else if (field === 'password') {
      error = !value ? 'Password is required' : undefined;
    }
    setFieldErrors((prev) => ({ ...prev, [field]: error }));
    return !error;
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, field === 'email' ? email : password);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate all fields
    const emailValid = validateField('email', email);
    const passwordValid = validateField('password', password);
    setTouched({ email: true, password: true });

    if (!emailValid || !passwordValid) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ email, password });
    } catch (err: any) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message === 'Invalid credentials' ? 'Invalid email or password. Please try again.' : message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const demoAccounts = [
    { email: 'admin@demo.com', label: 'Admin' },
    { email: 'manager@demo.com', label: 'Manager' },
    { email: 'wyatt@demo.com', label: 'Wyatt (Peak)' },
    { email: 'robert@demo.com', label: 'Robert (At Risk)' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-md w-full space-y-8 animate-fade-in">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <LogoFull />
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Guiding your team to peak performance
          </p>
        </div>

        <div className="card">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm animate-slide-up">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              </div>
            )}

            <FormInput
              label="Email address"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (touched.email) validateField('email', e.target.value);
              }}
              onBlur={() => handleBlur('email')}
              error={touched.email ? fieldErrors.email : undefined}
              placeholder="you@example.com"
            />

            <FormInput
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (touched.password) validateField('password', e.target.value);
              }}
              onBlur={() => handleBlur('password')}
              error={touched.password ? fieldErrors.password : undefined}
              placeholder="Enter your password"
              showPasswordToggle
            />

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="btn btn-primary w-full"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 divider text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link href="/register" className="link font-medium">
                Create one
              </Link>
            </p>
          </div>

          <div className="mt-4 pt-4 divider">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Quick login (demo accounts):</p>
            <div className="flex flex-wrap gap-2">
              {demoAccounts.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword('password123');
                    setFieldErrors({});
                    setTouched({});
                  }}
                  className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-gray-700 dark:text-gray-300 transition-colors"
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
