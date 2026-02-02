'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, ReactNode } from 'react';
import { AuthProvider } from './auth';
import { ThemeProvider } from '@/components/ThemeToggle';
import { ToastProvider } from '@/components/Toast';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import { GlobalWellnessMentor } from '@/components/GlobalWellnessMentor';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <ServiceWorkerRegistration />
            {children}
            <GlobalWellnessMentor />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
