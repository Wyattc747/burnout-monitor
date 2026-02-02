import { MarketingNav, MarketingFooter } from '@/components/marketing';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <MarketingNav />
      <main className="pt-16">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
