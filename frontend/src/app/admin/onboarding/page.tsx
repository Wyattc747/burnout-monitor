'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  Building2,
  Plug,
  Users,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Upload,
  UserPlus,
  Settings,
} from 'lucide-react';

type OnboardingStep = 'welcome' | 'integrations' | 'team' | 'complete';

const steps: { id: OnboardingStep; title: string; description: string }[] = [
  { id: 'welcome', title: 'Welcome', description: 'Get started' },
  { id: 'integrations', title: 'Integrations', description: 'Connect systems' },
  { id: 'team', title: 'Team Setup', description: 'Add employees' },
  { id: 'complete', title: 'Ready', description: 'All set' },
];

export default function AdminOnboardingPage() {
  const { user, isLoading } = useRequireAdmin();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const goToNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const goToPrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const finishOnboarding = () => {
    localStorage.setItem('admin_onboarding_complete', 'true');
    router.push('/admin/dashboard');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={clsx(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-medium',
                  index < currentStepIndex && 'bg-indigo-600 border-indigo-600 text-white',
                  index === currentStepIndex && 'border-indigo-600 text-indigo-600',
                  index > currentStepIndex && 'border-gray-300 text-gray-400'
                )}
              >
                {index < currentStepIndex ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  index + 1
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={clsx(
                    'w-20 h-1 mx-2',
                    index < currentStepIndex ? 'bg-indigo-600' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {steps.map((step) => (
            <div key={step.id} className="text-center" style={{ width: '80px' }}>
              <p className={clsx(
                'text-xs font-medium',
                step.id === currentStep ? 'text-indigo-600' : 'text-gray-500'
              )}>
                {step.title}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="card">
        {currentStep === 'welcome' && (
          <WelcomeStep organizationName={user?.organizationName} onContinue={goToNext} />
        )}

        {currentStep === 'integrations' && (
          <IntegrationsStep onBack={goToPrevious} onContinue={goToNext} />
        )}

        {currentStep === 'team' && (
          <TeamSetupStep onBack={goToPrevious} onContinue={goToNext} />
        )}

        {currentStep === 'complete' && (
          <CompleteStep onBack={goToPrevious} onFinish={finishOnboarding} />
        )}
      </div>
    </div>
  );
}

function WelcomeStep({ organizationName, onContinue }: { organizationName?: string; onContinue: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 mx-auto mb-6 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
        <Building2 className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Welcome to ShepHerd{organizationName ? `, ${organizationName}` : ''}!
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
        Let's get your organization set up. This will only take a few minutes.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left max-w-2xl mx-auto">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Plug className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-2" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Connect Systems</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Link your HR system to sync employees</p>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <Users className="w-6 h-6 text-green-600 dark:text-green-400 mb-2" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Add Your Team</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Import or invite employees</p>
        </div>
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <Settings className="w-6 h-6 text-purple-600 dark:text-purple-400 mb-2" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Organize</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Set up departments and managers</p>
        </div>
      </div>

      <button onClick={onContinue} className="btn btn-primary px-8">
        Get Started
        <ArrowRight className="w-4 h-4 ml-2" />
      </button>
    </div>
  );
}

function IntegrationsStep({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Connect Your HR System</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Automatically sync employees from your HR platform, or skip to add them manually.
        </p>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          HR integrations allow automatic employee sync, department mapping, and manager hierarchy import.
          You can always set this up later from Settings.
        </p>
      </div>

      <div className="grid gap-4 mb-6">
        {['BambooHR', 'Workday', 'ADP', 'Gusto', 'Rippling'].map((provider) => (
          <Link
            key={provider}
            href="/admin/integrations"
            className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <Plug className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
              <span className="font-medium text-gray-900 dark:text-white">{provider}</span>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </Link>
        ))}
      </div>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button onClick={onBack} className="btn btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button onClick={onContinue} className="btn btn-primary flex items-center gap-2">
          Skip for Now
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function TeamSetupStep({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Your Team</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Invite employees to join ShepHerd. They'll receive an email to set up their account.
        </p>
      </div>

      <div className="grid gap-4 mb-6">
        <Link
          href="/admin/employees?action=invite"
          className="flex items-center gap-4 p-6 border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
        >
          <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Invite Employees</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Send email invitations to your team</p>
          </div>
          <ArrowRight className="w-5 h-5 text-indigo-600 dark:text-indigo-400 ml-auto" />
        </Link>

        <Link
          href="/admin/employees"
          className="flex items-center gap-4 p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <Upload className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Import from CSV</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Bulk import employees from a spreadsheet</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 ml-auto" />
        </Link>

        <Link
          href="/admin/departments"
          className="flex items-center gap-4 p-6 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Set Up Departments</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Create departments and assign managers</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400 ml-auto" />
        </Link>
      </div>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <button onClick={onBack} className="btn btn-secondary flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button onClick={onContinue} className="btn btn-primary flex items-center gap-2">
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CompleteStep({ onBack, onFinish }: { onBack: () => void; onFinish: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 mx-auto mb-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
        <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">You're All Set!</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
        Your organization is ready. You can now start managing your team's wellness.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 text-left max-w-lg mx-auto">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Next Steps</h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Invite your team members
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Set up departments
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Connect HR integrations
            </li>
          </ul>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Employee Onboarding</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            When employees accept their invitations, they'll go through their own onboarding to connect health devices and set preferences.
          </p>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <button onClick={onBack} className="btn btn-secondary">
          Back
        </button>
        <button onClick={onFinish} className="btn btn-primary px-8">
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
