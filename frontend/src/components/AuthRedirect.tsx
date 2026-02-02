'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function AuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Check if user has a token and redirect to dashboard
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  // This component doesn't render anything visible
  return null;
}
