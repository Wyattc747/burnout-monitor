'use client';

import Link from 'next/link';
import { LogoFull } from '@/components/Logo';

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

interface MarketingFooterProps {
  sections?: FooterSection[];
}

const defaultSections: FooterSection[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '/features' },
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Login', href: '/login' },
      { label: 'Get Started', href: '/register' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/how-it-works' },
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
      { label: 'Contact', href: '#' },
    ],
  },
];

export function MarketingFooter({ sections = defaultSections }: MarketingFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 dark:bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="mb-4">
              <LogoFull dark />
            </div>
            <p className="text-gray-400 max-w-md">
              Guiding your team to peak performance through intelligent wellness monitoring and proactive burnout prevention.
            </p>
          </div>

          {/* Dynamic Sections */}
          {sections.map((section) => (
            <div key={section.title}>
              <h4 className="font-semibold mb-4">{section.title}</h4>
              <ul className="space-y-2 text-gray-400">
                {section.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('/') ? (
                      <Link href={link.href} className="hover:text-white transition-colors">
                        {link.label}
                      </Link>
                    ) : (
                      <a href={link.href} className="hover:text-white transition-colors">
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400 text-sm">
          <p>&copy; {currentYear} ShepHerd. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
