'use client';

import { Navbar } from '@/components/Navbar';
import { WellnessResources } from '@/components/WellnessResources';

export default function WellnessPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="container-page">
        <WellnessResources />
      </main>
    </div>
  );
}
