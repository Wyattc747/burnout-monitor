'use client';

import Link from 'next/link';

// Timeline data for development process
const timeline = [
  {
    phase: 'Research',
    title: 'Understanding the Problem',
    description: 'Deep dive into workplace burnout statistics, employee wellness research, and existing solutions.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    phase: 'Design',
    title: 'Privacy-First Architecture',
    description: 'Designing a system that provides valuable insights to managers while protecting employee privacy.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    phase: 'Development',
    title: 'AI-Powered Building',
    description: 'Iterative development with Claude as an AI pair programmer, focusing on clean code and user experience.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    phase: 'Integration',
    title: 'Wearable Connections',
    description: 'Secure integrations with health platforms to gather real-time wellness data with user consent.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    phase: 'Testing',
    title: 'Algorithm Refinement',
    description: 'Continuous refinement of the wellness scoring algorithm based on research and feedback.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    phase: 'Launch',
    title: 'Ready to Help',
    description: 'ShepHerd is ready to guide teams toward healthier, more sustainable work practices.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
];

const technologies = [
  {
    name: 'Next.js 14',
    description: 'React framework with App Router for fast, SEO-friendly pages',
    category: 'Frontend',
    color: 'from-gray-600 to-gray-800',
  },
  {
    name: 'React',
    description: 'Component-based UI with hooks for state management',
    category: 'Frontend',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    name: 'Node.js',
    description: 'Express-based API server for scalable backend services',
    category: 'Backend',
    color: 'from-green-500 to-emerald-600',
  },
  {
    name: 'PostgreSQL',
    description: 'Robust relational database for secure data storage',
    category: 'Database',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    name: 'OpenAI',
    description: 'AI-powered conversations and intelligent insights',
    category: 'AI',
    color: 'from-emerald-400 to-teal-500',
  },
  {
    name: 'Wearable APIs',
    description: 'Real-time health data from fitness trackers and smartwatches',
    category: 'Integration',
    color: 'from-purple-500 to-pink-500',
  },
];

const values = [
  {
    title: 'Privacy First',
    description: 'Individual health data is never exposed to managers. Only aggregated, anonymized insights are shared.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    title: 'Proactive Care',
    description: 'Identify warning signs before burnout happens. Prevention is always better than cure.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Human-Centered',
    description: 'Technology should serve people. Every feature is designed with employee wellbeing at its core.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    title: 'Data-Driven',
    description: 'Our wellness scoring algorithm is grounded in peer-reviewed research and continuously refined.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-gray-900 to-blue-900/20 dark:from-emerald-900/30 dark:via-gray-900 dark:to-blue-900/30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="inline-block px-4 py-1.5 mb-6 text-sm font-medium text-emerald-400 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              The Story Behind ShepHerd
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              How It Was{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Built
              </span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              From a vision of healthier workplaces to a reality that helps teams thrive.
              Discover the technology, values, and passion that power ShepHerd.
            </p>
          </div>
        </div>
      </section>

      {/* The Vision Section */}
      <section className="py-20 bg-white dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <span className="text-emerald-500 font-semibold tracking-wide uppercase text-sm">
                The Vision
              </span>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                Why Burnout Prevention Matters
              </h2>
              <div className="mt-6 space-y-6 text-gray-600 dark:text-gray-300">
                <p>
                  Workplace burnout has reached epidemic proportions. The World Health Organization
                  officially recognized burnout as an occupational phenomenon, with studies showing
                  that <span className="text-gray-900 dark:text-white font-semibold">76% of employees</span> experience
                  burnout at least sometimes.
                </p>
                <p>
                  The traditional approach has been reactive - waiting until employees show clear signs
                  of exhaustion, disengagement, or leave the company entirely. By then, the damage is done.
                </p>
                <p>
                  <span className="text-emerald-500 font-semibold">ShepHerd was built on a different premise:</span> What if
                  we could identify early warning signs and intervene before burnout takes hold?
                  What if managers could support their teams proactively, not reactively?
                </p>
              </div>
            </div>

            {/* Stats visualization */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card bg-gradient-to-br from-red-500/10 to-orange-500/10 dark:from-red-500/20 dark:to-orange-500/20 border-red-200/50 dark:border-red-800/50">
                <div className="text-4xl font-bold text-red-500 mb-2">76%</div>
                <div className="text-gray-600 dark:text-gray-300 text-sm">
                  of employees experience burnout at least sometimes
                </div>
                <div className="text-xs text-gray-400 mt-2">Gallup Research</div>
              </div>
              <div className="card bg-gradient-to-br from-yellow-500/10 to-amber-500/10 dark:from-yellow-500/20 dark:to-amber-500/20 border-yellow-200/50 dark:border-yellow-800/50">
                <div className="text-4xl font-bold text-yellow-500 mb-2">48%</div>
                <div className="text-gray-600 dark:text-gray-300 text-sm">
                  of workers globally report burnout
                </div>
                <div className="text-xs text-gray-400 mt-2">BCG 2024 Study</div>
              </div>
              <div className="card bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 border-blue-200/50 dark:border-blue-800/50">
                <div className="text-4xl font-bold text-blue-500 mb-2">41%</div>
                <div className="text-gray-600 dark:text-gray-300 text-sm">
                  feel daily workplace stress
                </div>
                <div className="text-xs text-gray-400 mt-2">Gallup Global Workplace 2024</div>
              </div>
              <div className="card bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border-emerald-200/50 dark:border-emerald-800/50">
                <div className="text-4xl font-bold text-emerald-500 mb-2">2.6x</div>
                <div className="text-gray-600 dark:text-gray-300 text-sm">
                  more likely to seek a new job
                </div>
                <div className="text-xs text-gray-400 mt-2">Gallup Research</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-emerald-500 font-semibold tracking-wide uppercase text-sm">
              The Technology
            </span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Built with Modern Tools
            </h2>
            <p className="mt-4 text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              A carefully chosen tech stack designed for performance, security, and scalability.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {technologies.map((tech, index) => (
              <div
                key={index}
                className="card group hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${tech.color} mb-4`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">
                  {tech.category}
                </span>
                <h3 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
                  {tech.name}
                </h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  {tech.description}
                </p>
              </div>
            ))}
          </div>

          {/* Architecture diagram placeholder */}
          <div className="mt-16 card bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-800 dark:to-gray-950 border-gray-700 overflow-hidden">
            <div className="text-center py-12">
              <h3 className="text-xl font-bold text-white mb-4">Privacy-First Architecture</h3>
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-sm">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <span className="text-gray-300">Employees</span>
                </div>
                <svg className="w-8 h-8 text-gray-600 rotate-90 md:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-2">
                    <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <span className="text-gray-300">Encrypted Data</span>
                </div>
                <svg className="w-8 h-8 text-gray-600 rotate-90 md:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mb-2">
                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <span className="text-gray-300">AI Processing</span>
                </div>
                <svg className="w-8 h-8 text-gray-600 rotate-90 md:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-2">
                    <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span className="text-gray-300">Team Insights</span>
                </div>
                <svg className="w-8 h-8 text-gray-600 rotate-90 md:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mb-2">
                    <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="text-gray-300">Managers</span>
                </div>
              </div>
              <p className="mt-8 text-gray-400 max-w-2xl mx-auto">
                Personal health data is encrypted and processed through our AI. Managers only see
                aggregated wellness scores and actionable insights - never individual health metrics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Development Process / Timeline Section */}
      <section className="py-20 bg-white dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-emerald-500 font-semibold tracking-wide uppercase text-sm">
              The Development Process
            </span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              From Idea to Reality
            </h2>
            <p className="mt-4 text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Built iteratively with a focus on user experience and data privacy.
            </p>
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Timeline line */}
            <div className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-emerald-500 via-teal-500 to-blue-500 rounded-full" />

            <div className="space-y-12">
              {timeline.map((item, index) => (
                <div key={index} className={`relative flex items-center ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}>
                  {/* Content */}
                  <div className={`w-full lg:w-5/12 ${index % 2 === 0 ? 'lg:pr-12 lg:text-right' : 'lg:pl-12'}`}>
                    <div className="card hover:shadow-lg transition-all duration-300">
                      <span className="inline-block px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 rounded-full mb-3">
                        {item.phase}
                      </span>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {item.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Center icon */}
                  <div className="hidden lg:flex absolute left-1/2 transform -translate-x-1/2 w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full items-center justify-center text-white shadow-lg">
                    {item.icon}
                  </div>

                  {/* Empty space for the other side */}
                  <div className="hidden lg:block w-5/12" />
                </div>
              ))}
            </div>
          </div>

          {/* AI Pair Programming highlight */}
          <div className="mt-20 card bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 border-purple-200/50 dark:border-purple-800/50">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Built with AI Pair Programming
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  ShepHerd was developed using <span className="font-semibold text-purple-600 dark:text-purple-400">Claude</span> as
                  an AI pair programmer. This collaborative approach enabled rapid iteration on features,
                  thoughtful architecture decisions, and a focus on clean, maintainable code. AI-assisted
                  development allowed us to move fast while maintaining quality.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-emerald-500 font-semibold tracking-wide uppercase text-sm">
              Our Values
            </span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Principles That Guide Us
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <div key={index} className="card text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400 mb-4">
                  {value.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {value.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {value.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="py-20 bg-white dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-emerald-500 font-semibold tracking-wide uppercase text-sm">
              The Team
            </span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              The People Behind ShepHerd
            </h2>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="card bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:from-emerald-500/10 dark:to-teal-500/10 border-emerald-200/50 dark:border-emerald-800/50">
              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Founder avatar placeholder */}
                <div className="flex-shrink-0">
                  <div className="w-32 h-32 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center">
                    <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Founder Name
                  </h3>
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium mb-4">
                    Founder & Creator
                  </p>
                  <p className="text-gray-600 dark:text-gray-300">
                    [Your story here] - A passion for building products that make a real difference
                    in people's lives. After witnessing firsthand the toll that burnout takes on
                    talented professionals, I set out to build a tool that could help teams thrive,
                    not just survive.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Mission statement */}
          <div className="mt-16 text-center">
            <div className="inline-block">
              <blockquote className="text-2xl md:text-3xl font-light text-gray-900 dark:text-white italic">
                "Our mission is to create workplaces where people can do their best work
                without sacrificing their wellbeing."
              </blockquote>
              <div className="mt-4 w-24 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 mx-auto rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-emerald-600 to-teal-600 dark:from-emerald-700 dark:to-teal-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Team's Wellbeing?
          </h2>
          <p className="text-xl text-emerald-100 max-w-2xl mx-auto mb-8">
            Join the growing number of organizations using ShepHerd to build healthier,
            more productive teams.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="btn bg-white text-emerald-600 hover:bg-gray-100 px-8 py-3 text-lg font-semibold"
            >
              Get Started Free
            </Link>
            <Link
              href="/login"
              className="btn bg-transparent text-white border-2 border-white/30 hover:bg-white/10 px-8 py-3 text-lg font-semibold"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
