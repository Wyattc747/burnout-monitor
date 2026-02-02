'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';

interface ApiErrorHandlerProps {
  error: Error | AxiosError | null;
  children?: ReactNode;
  onRetry?: () => void;
}

interface ApiErrorDetails {
  title: string;
  message: string;
  showRetry: boolean;
  showLogin: boolean;
  showHome: boolean;
}

function getErrorDetails(error: Error | AxiosError | null): ApiErrorDetails {
  if (!error) {
    return {
      title: 'Unknown Error',
      message: 'An unexpected error occurred.',
      showRetry: true,
      showLogin: false,
      showHome: true,
    };
  }

  // Check if it's an Axios error with a response
  if ('response' in error && error.response) {
    const status = error.response.status;
    const data = error.response.data as { message?: string } | undefined;
    const serverMessage = data?.message;

    switch (status) {
      case 401:
        return {
          title: 'Session Expired',
          message: 'Your session has expired. Please log in again to continue.',
          showRetry: false,
          showLogin: true,
          showHome: false,
        };
      case 403:
        return {
          title: 'Access Denied',
          message: serverMessage || 'You do not have permission to access this resource.',
          showRetry: false,
          showLogin: false,
          showHome: true,
        };
      case 404:
        return {
          title: 'Not Found',
          message: serverMessage || 'The requested resource could not be found.',
          showRetry: false,
          showLogin: false,
          showHome: true,
        };
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          title: 'Server Error',
          message: 'Our servers are experiencing issues. Please try again later.',
          showRetry: true,
          showLogin: false,
          showHome: true,
        };
      default:
        return {
          title: 'Request Failed',
          message: serverMessage || 'Something went wrong with your request.',
          showRetry: true,
          showLogin: false,
          showHome: true,
        };
    }
  }

  // Network error (no response)
  if ('code' in error && error.code === 'ERR_NETWORK') {
    return {
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection.',
      showRetry: true,
      showLogin: false,
      showHome: false,
    };
  }

  // Generic error
  return {
    title: 'Error',
    message: error.message || 'An unexpected error occurred.',
    showRetry: true,
    showLogin: false,
    showHome: true,
  };
}

export function ApiErrorHandler({ error, children, onRetry }: ApiErrorHandlerProps) {
  const router = useRouter();
  const details = getErrorDetails(error);

  const handleLogin = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('employeeId');
    router.push('/login');
  };

  const handleHome = () => {
    router.push('/dashboard');
  };

  if (!error) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {details.title}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          {details.message}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {details.showRetry && onRetry && (
            <button
              onClick={onRetry}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
          )}
          {details.showLogin && (
            <button
              onClick={handleLogin}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
            >
              Log In
            </button>
          )}
          {details.showHome && (
            <button
              onClick={handleHome}
              className="px-6 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Go to Dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook for using with React Query
export function useApiError() {
  const router = useRouter();

  const handleError = (error: Error | AxiosError) => {
    if ('response' in error && error.response) {
      const status = error.response.status;

      switch (status) {
        case 401:
          localStorage.removeItem('token');
          localStorage.removeItem('employeeId');
          router.push('/login');
          break;
        case 403:
          console.error('Access denied:', error.response.data);
          break;
        case 404:
          console.error('Resource not found:', error.response.data);
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          console.error('Server error:', error.response.data);
          break;
      }
    } else if ('code' in error && error.code === 'ERR_NETWORK') {
      console.error('Network error - unable to connect to server');
    }
  };

  return { handleError };
}
