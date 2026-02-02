'use client';

import Link from 'next/link';
import { useState } from 'react';

// Check Icon
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

// Pricing tier data
const pricingTiers = [
  {
    id: 'trial',
    name: 'Free Trial',
    description: 'Perfect for exploring ShepHerd with your team',
    priceMonthly: 0,
    priceAnnual: 0,
    maxEmployees: 10,
    duration: '14 days',
    features: [
      'Personal wellness dashboard',
      'Basic burnout risk scoring',
      '1 wearable device sync',
      'Manual wellness check-ins',
      'Email notifications',
      'Up to 10 employees',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/register',
    popular: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'Essential tools for small teams',
    priceMonthly: 6,
    priceAnnual: 5,
    maxEmployees: 50,
    perEmployee: true,
    features: [
      'Everything in Free Trial',
      'Team wellness dashboard',
      'Manager alerts & notifications',
      'Google Calendar & Outlook sync',
      'Sleep & HRV monitoring',
      'Zone classification (Green/Yellow/Red)',
      'Email support (48hr response)',
      '30-day data retention',
      'Up to 50 employees',
    ],
    cta: 'Get Started',
    ctaHref: '/signup/business',
    popular: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Advanced features for growing organizations',
    priceMonthly: 10,
    priceAnnual: 8,
    maxEmployees: 500,
    perEmployee: true,
    features: [
      'Everything in Starter',
      'Advanced analytics & reporting',
      'Predictive burnout alerts',
      'AI Wellness Mentor (Shepherd Chat)',
      'Custom wellness thresholds',
      'Full HR integrations (BambooHR, Workday)',
      'Slack & Teams notifications',
      'API access',
      '1:1 meeting suggestions',
      'Team wellness heatmaps',
      'Priority support (24hr response)',
      '90-day data retention',
      'Up to 500 employees',
    ],
    cta: 'Get Started',
    ctaHref: '/signup/business',
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Custom solutions for large organizations',
    priceMonthly: null,
    priceAnnual: null,
    maxEmployees: Infinity,
    perEmployee: true,
    features: [
      'Everything in Professional',
      'SSO/SAML authentication',
      'SCIM user provisioning',
      'Dedicated Customer Success Manager',
      'Custom integrations',
      '99.9% uptime SLA',
      'Data residency options (US, EU, APAC)',
      'SOC 2 & HIPAA compliance',
      'Custom reporting & dashboards',
      'Unlimited data retention',
      'Executive wellness briefings',
      'Unlimited employees',
    ],
    cta: 'Contact Sales',
    ctaHref: '/contact',
    popular: false,
  },
];

// FAQ data
const faqs = [
  {
    question: 'How does the free trial work?',
    answer: 'Start with a 14-day free trial with up to 10 employees. No credit card required. You get full access to the Trial features, and can upgrade to a paid plan anytime.',
  },
  {
    question: 'Can I change plans later?',
    answer: 'Yes! You can upgrade or downgrade your plan at any time. When upgrading, you\'ll get immediate access to new features. When downgrading, your current plan continues until the end of your billing period.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, American Express) and can set up invoicing for Enterprise customers. All payments are securely processed through Stripe.',
  },
  {
    question: 'Is there a discount for annual billing?',
    answer: 'Yes! Annual billing saves you approximately 17% compared to monthly billing. That\'s like getting 2 months free each year.',
  },
  {
    question: 'What happens if I exceed my employee limit?',
    answer: 'We\'ll notify you when you\'re approaching your limit. You can easily upgrade to a higher tier to accommodate more employees. We won\'t cut off access unexpectedly.',
  },
  {
    question: 'Do you offer discounts for nonprofits?',
    answer: 'Yes! We offer special pricing for registered nonprofits and educational institutions. Contact our sales team to learn more about our nonprofit program.',
  },
  {
    question: 'What integrations are included?',
    answer: 'Starter includes Google Calendar and Outlook. Professional adds BambooHR, Workday, ADP, Slack, and Microsoft Teams. Enterprise includes custom integrations built for your specific needs.',
  },
  {
    question: 'How secure is my data?',
    answer: 'Security is our top priority. We use industry-standard encryption, are SOC 2 compliant, and Enterprise customers can choose data residency locations. All health data is handled in compliance with HIPAA.',
  },
];

// Pricing Card Component
function PricingCard({
  tier,
  isAnnual,
}: {
  tier: typeof pricingTiers[0];
  isAnnual: boolean;
}) {
  const price = isAnnual ? tier.priceAnnual : tier.priceMonthly;
  const isEnterprise = tier.id === 'enterprise';

  return (
    <div
      className={`relative bg-white dark:bg-gray-800 rounded-2xl p-8 ${
        tier.popular
          ? 'ring-2 ring-emerald-500 dark:ring-emerald-400 shadow-xl shadow-emerald-500/10'
          : 'border border-gray-200 dark:border-gray-700 shadow-lg'
      }`}
    >
      {/* Popular Badge */}
      {tier.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg">
            Most Popular
          </span>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-8">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {tier.name}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {tier.description}
        </p>
      </div>

      {/* Price */}
      <div className="text-center mb-8">
        {isEnterprise ? (
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">Custom</span>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">
                ${price}
              </span>
              {tier.perEmployee && (
                <span className="text-gray-500 dark:text-gray-400">/employee/mo</span>
              )}
            </div>
            {tier.duration && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{tier.duration}</p>
            )}
            {isAnnual && tier.priceMonthly && tier.priceMonthly > 0 && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">
                Save ${((tier.priceMonthly - tier.priceAnnual) * 12).toFixed(0)}/employee/year
              </p>
            )}
          </>
        )}
      </div>

      {/* CTA */}
      <Link
        href={tier.ctaHref}
        className={`block w-full text-center px-6 py-3 rounded-lg font-semibold transition-all duration-200 mb-8 ${
          tier.popular
            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
      >
        {tier.cta}
      </Link>

      {/* Features */}
      <ul className="space-y-3">
        {tier.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckIcon className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-600 dark:text-gray-400">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// FAQ Item Component
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-4 flex items-center justify-between text-left"
      >
        <span className="font-medium text-gray-900 dark:text-white">{question}</span>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="pb-4">
          <p className="text-gray-600 dark:text-gray-400">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function PricingPage() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-emerald-50 dark:from-gray-900 dark:via-gray-900 dark:to-emerald-950 pt-16 pb-8">

        {/* Gradient Orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-400/20 dark:bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-400/20 dark:bg-blue-600/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Simple, transparent pricing
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Choose the Right Plan for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
              Your Team
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed">
            Start with a free trial, then scale as your organization grows. All plans include
            our core burnout monitoring and wellness features.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                !isAnnual
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                isAnnual
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Annual
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full">
                Save 17%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {pricingTiers.map((tier) => (
              <PricingCard key={tier.id} tier={tier} isAnnual={isAnnual} />
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-16 md:py-24 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Compare Plans
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              See which plan has the features you need
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">Feature</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-900 dark:text-white">Trial</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-900 dark:text-white">Starter</th>
                  <th className="text-center py-4 px-4 font-semibold text-emerald-600 dark:text-emerald-400">Professional</th>
                  <th className="text-center py-4 px-4 font-semibold text-gray-900 dark:text-white">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[
                  { feature: 'Max Employees', trial: '10', starter: '50', professional: '500', enterprise: 'Unlimited' },
                  { feature: 'Personal Dashboard', trial: true, starter: true, professional: true, enterprise: true },
                  { feature: 'Team Dashboard', trial: false, starter: true, professional: true, enterprise: true },
                  { feature: 'Burnout Risk Scoring', trial: 'Basic', starter: 'Basic', professional: 'Advanced', enterprise: 'Custom' },
                  { feature: 'Wearable Sync', trial: '1 device', starter: 'All devices', professional: 'All devices', enterprise: 'All devices' },
                  { feature: 'Calendar Integration', trial: false, starter: true, professional: true, enterprise: true },
                  { feature: 'Manager Alerts', trial: false, starter: true, professional: true, enterprise: true },
                  { feature: 'Predictive Alerts', trial: false, starter: false, professional: true, enterprise: true },
                  { feature: 'AI Wellness Mentor', trial: false, starter: false, professional: true, enterprise: true },
                  { feature: 'Team Heatmaps', trial: false, starter: false, professional: true, enterprise: true },
                  { feature: 'HR Integrations', trial: false, starter: false, professional: true, enterprise: 'Custom' },
                  { feature: 'Slack/Teams', trial: false, starter: false, professional: true, enterprise: true },
                  { feature: 'API Access', trial: false, starter: false, professional: true, enterprise: true },
                  { feature: 'SSO/SAML', trial: false, starter: false, professional: false, enterprise: true },
                  { feature: 'Dedicated CSM', trial: false, starter: false, professional: false, enterprise: true },
                  { feature: 'Custom SLA', trial: false, starter: false, professional: false, enterprise: true },
                  { feature: 'Data Retention', trial: '7 days', starter: '30 days', professional: '90 days', enterprise: 'Unlimited' },
                  { feature: 'Support', trial: 'Email', starter: 'Email (48hr)', professional: 'Priority (24hr)', enterprise: 'Dedicated' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">{row.feature}</td>
                    <td className="text-center py-4 px-4">
                      {typeof row.trial === 'boolean' ? (
                        row.trial ? (
                          <CheckIcon className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )
                      ) : (
                        <span className="text-sm text-gray-600 dark:text-gray-400">{row.trial}</span>
                      )}
                    </td>
                    <td className="text-center py-4 px-4">
                      {typeof row.starter === 'boolean' ? (
                        row.starter ? (
                          <CheckIcon className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )
                      ) : (
                        <span className="text-sm text-gray-600 dark:text-gray-400">{row.starter}</span>
                      )}
                    </td>
                    <td className="text-center py-4 px-4 bg-emerald-50/50 dark:bg-emerald-900/10">
                      {typeof row.professional === 'boolean' ? (
                        row.professional ? (
                          <CheckIcon className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )
                      ) : (
                        <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">{row.professional}</span>
                      )}
                    </td>
                    <td className="text-center py-4 px-4">
                      {typeof row.enterprise === 'boolean' ? (
                        row.enterprise ? (
                          <CheckIcon className="w-5 h-5 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )
                      ) : (
                        <span className="text-sm text-gray-600 dark:text-gray-400">{row.enterprise}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Everything you need to know about pricing and plans
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 md:p-8 shadow-lg border border-gray-200 dark:border-gray-700">
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-emerald-600 to-teal-600 dark:from-emerald-700 dark:to-teal-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to protect your team from burnout?
          </h2>
          <p className="text-lg text-emerald-100 mb-8 max-w-2xl mx-auto">
            Start your free 14-day trial today. No credit card required.
            See how ShepHerd can transform your team&apos;s wellness.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg bg-white text-emerald-600 hover:bg-gray-100 shadow-lg transition-all duration-200"
            >
              Start Free Trial
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 border border-emerald-500 transition-all duration-200"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
