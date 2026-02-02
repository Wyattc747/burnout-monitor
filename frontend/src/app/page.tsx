import Link from 'next/link';
import { MarketingNav, MarketingFooter } from '@/components/marketing';

export default function Home() {
  const pillars = [
    {
      title: 'Discipline',
      description: 'Building consistent wellness habits through daily check-ins, goal tracking, and personalized routines that become second nature.',
      howWeHelp: 'ShepHerd automates daily wellness check-ins, sets personalized goals, and tracks your streaks. Get gentle reminders to log your mood, celebrate milestones, and build habits that stick without the mental overhead.',
      emoji: '✓',
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
    },
    {
      title: 'Detail',
      description: 'Tracking the metrics that matter - sleep quality, stress levels, work patterns, and energy fluctuations with precision analytics.',
      howWeHelp: 'Automatic sync with wearables captures sleep, heart rate, and activity data. Calendar integration tracks meeting load and focus time. Our AI analyzes patterns you\'d never spot yourself.',
      emoji: '📊',
      gradient: 'from-purple-500 to-purple-600',
      bgGradient: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20',
    },
    {
      title: 'Asking for Help',
      description: 'AI-powered wellness mentor and seamless manager support channels ensure you never face burnout alone.',
      howWeHelp: 'Chat with Shepherd, your 24/7 AI wellness mentor, anytime you need support. Log life events that affect work, and optionally share context with your manager to get the understanding you need.',
      emoji: '💬',
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-800/20',
    },
    {
      title: 'Switching Gears',
      description: 'Learn to operate optimally by recognizing when to push forward, when to recover, and how to transition between modes effectively.',
      howWeHelp: 'Real-time wellness zones (Green/Yellow/Red) show when you\'re thriving vs. need rest. Predictive alerts warn before burnout hits. Personalized recommendations help you know when to push and when to recover.',
      emoji: '🔄',
      gradient: 'from-emerald-500 to-teal-500',
      bgGradient: 'from-emerald-50 to-teal-100 dark:from-emerald-900/20 dark:to-teal-800/20',
    },
  ];

  const features = [
    {
      title: 'Real-Time Wellness Monitoring',
      description: 'Track burnout indicators as they happen with intelligent pattern recognition.',
    },
    {
      title: 'AI Wellness Mentor',
      description: 'Get personalized guidance and support from your always-available AI companion.',
    },
    {
      title: 'Team Insights',
      description: 'Managers get anonymized team wellness trends without compromising privacy.',
    },
    {
      title: 'Smart Recommendations',
      description: 'Receive actionable suggestions tailored to your unique work patterns and needs.',
    },
    {
      title: 'Predictive Analytics',
      description: 'Anticipate burnout before it happens with machine learning predictions.',
    },
    {
      title: 'Privacy-First Design',
      description: 'Your data stays yours. We prioritize privacy at every level of the platform.',
    },
  ];


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
        <MarketingNav />

        <main className="pt-16">
          {/* Hero Section */}
          <section className="relative overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800" />

            {/* Decorative elements */}
            <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-300/20 dark:bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-300/20 dark:bg-blue-500/10 rounded-full blur-3xl" />

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40">
              <div className="text-center max-w-4xl mx-auto">
                <div className="inline-flex items-center gap-2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-4 py-2 rounded-full text-sm font-medium mb-8">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Proactive burnout prevention powered by AI
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white leading-tight mb-6">
                  Prevent Burnout,{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-500">
                    Protect Your Team
                  </span>
                </h1>

                <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-10">
                  ShepHerd is the intelligent wellness platform that helps you recognize burnout early, build sustainable habits, and guide your team to peak performance.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-200"
                  >
                    Get Started Free
                  </Link>
                  <Link
                    href="/features"
                    className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg bg-white text-gray-900 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 shadow-lg transition-all duration-200"
                  >
                    <span className="flex items-center gap-2">
                      View Features
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </Link>
                </div>

                {/* Stats - The Problem */}
                <div className="mt-16 pt-16 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 uppercase tracking-wider font-medium">The burnout crisis is real</p>
                  <div className="grid grid-cols-3 gap-8">
                    <div>
                      <div className="text-3xl sm:text-4xl font-bold text-red-500 dark:text-red-400">76%</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">of employees experience burnout</div>
                    </div>
                    <div>
                      <div className="text-3xl sm:text-4xl font-bold text-amber-500 dark:text-amber-400">2.6x</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">more likely to seek a new job</div>
                    </div>
                    <div>
                      <div className="text-3xl sm:text-4xl font-bold text-blue-500 dark:text-blue-400">41%</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">feel daily workplace stress</div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">Source: Gallup State of the Global Workplace 2024</p>
                </div>
              </div>
            </div>
          </section>

          {/* 4 Pillars Section */}
          <section id="pillars" className="py-24 bg-white dark:bg-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                  The Four Pillars of Sustainable Performance
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  Our methodology is built on four essential principles that transform how teams approach wellness and productivity.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {pillars.map((pillar) => (
                  <div
                    key={pillar.title}
                    className={`relative p-8 rounded-2xl bg-gradient-to-br ${pillar.bgGradient} border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:-translate-y-1`}
                  >
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${pillar.gradient} text-white text-2xl mb-6`}>
                      {pillar.emoji}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                      {pillar.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                      {pillar.description}
                    </p>
                    <div className="pt-4 border-t border-gray-200/50 dark:border-gray-600/50">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        How ShepHerd Helps
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                        {pillar.howWeHelp}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Features Preview Section */}
          <section id="features" className="py-24 bg-gray-50 dark:bg-gray-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-3xl mx-auto mb-16">
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                  Everything You Need to Thrive
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300">
                  Comprehensive tools designed to support individual wellness while enabling team-level insights.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {features.map((feature) => (
                  <div
                    key={feature.title}
                    className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 mb-4">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className="text-center mt-12">
                <Link
                  href="/features"
                  className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                >
                  See all features
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </section>

          {/* How It Works Preview */}
          <section className="py-24 bg-gray-50 dark:bg-gray-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">
                    Built with Modern Technology
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                    ShepHerd combines wearable health data, work analytics, and AI-powered insights to automatically detect burnout risks and guide your team to peak performance.
                  </p>
                  <ul className="space-y-4">
                    {['Privacy-first architecture', 'AI-powered recommendations', 'Seamless integrations', 'Real-time monitoring'].map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                          <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-gray-700 dark:text-gray-300">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-8">
                    <Link
                      href="/how-it-works"
                      className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                    >
                      Learn how we built ShepHerd
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 text-center">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-sm">
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                        <span className="text-2xl">👤</span>
                      </div>
                      <span className="text-gray-300">Employees</span>
                    </div>
                    <svg className="w-8 h-8 text-gray-600 rotate-90 md:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-2">
                        <span className="text-2xl">🔒</span>
                      </div>
                      <span className="text-gray-300">Encrypted</span>
                    </div>
                    <svg className="w-8 h-8 text-gray-600 rotate-90 md:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-2">
                        <span className="text-2xl">🤖</span>
                      </div>
                      <span className="text-gray-300">AI Processing</span>
                    </div>
                    <svg className="w-8 h-8 text-gray-600 rotate-90 md:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-2">
                        <span className="text-2xl">📊</span>
                      </div>
                      <span className="text-gray-300">Insights</span>
                    </div>
                  </div>
                  <p className="mt-8 text-gray-400 text-sm">
                    Personal health data is encrypted and processed through our AI. Managers only see aggregated wellness scores - never individual health metrics.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* CTA Section */}
          <section className="py-24 bg-gradient-to-br from-emerald-600 to-teal-600 dark:from-emerald-700 dark:to-teal-700">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                Ready to Transform Your Team&apos;s Wellness?
              </h2>
              <p className="text-lg text-emerald-100 mb-10 max-w-2xl mx-auto">
                Join thousands of teams who have already discovered the power of proactive burnout prevention. Start your journey today.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg bg-white text-emerald-600 hover:bg-gray-100 transition-all duration-200"
                >
                  Get Started Free
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold rounded-lg bg-transparent text-white border-2 border-emerald-400/50 hover:bg-emerald-700/30 transition-all duration-200"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </section>
        </main>

        <MarketingFooter />
      </div>
  );
}
