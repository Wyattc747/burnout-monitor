'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { billingApi } from '@/lib/api';
import type { SubscriptionTierInfo } from '@/types';
import { LogoFull } from '@/components/Logo';

type Step = 'company' | 'admin' | 'plan' | 'success';

const INDUSTRY_OPTIONS = [
  'Technology',
  'Healthcare',
  'Finance',
  'Manufacturing',
  'Retail',
  'Professional Services',
  'Education',
  'Non-profit',
  'Other',
];

const COMPANY_SIZE_OPTIONS = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1000+',
];

export default function BusinessSignupPage() {
  const { registerOrganization } = useAuth();
  const [step, setStep] = useState<Step>('company');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tiers, setTiers] = useState<SubscriptionTierInfo[]>([]);

  const [formData, setFormData] = useState({
    // Company info
    companyName: '',
    industry: '',
    companySize: '',
    subdomain: '',
    // Admin account
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    // Plan selection
    selectedTier: 'trial',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Auto-generate subdomain from company name
    if (name === 'companyName') {
      const subdomain = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);
      setFormData((prev) => ({ ...prev, subdomain }));
    }
  };

  const validateCompanyStep = () => {
    if (!formData.companyName.trim()) {
      setError('Company name is required');
      return false;
    }
    if (formData.companyName.length < 2) {
      setError('Company name must be at least 2 characters');
      return false;
    }
    return true;
  };

  const validateAdminStep = () => {
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First and last name are required');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleNextStep = async () => {
    setError('');

    if (step === 'company') {
      if (!validateCompanyStep()) return;
      setStep('admin');
    } else if (step === 'admin') {
      if (!validateAdminStep()) return;
      // Load tiers before showing plan selection
      try {
        const { tiers: availableTiers } = await billingApi.getTiers();
        setTiers(availableTiers);
      } catch (err) {
        // If tiers fail to load, just show trial option
        setTiers([]);
      }
      setStep('plan');
    } else if (step === 'plan') {
      await handleSubmit();
    }
  };

  const handlePrevStep = () => {
    setError('');
    if (step === 'admin') setStep('company');
    else if (step === 'plan') setStep('admin');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      await registerOrganization({
        companyName: formData.companyName,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        industry: formData.industry || undefined,
        companySize: formData.companySize || undefined,
        subdomain: formData.subdomain || undefined,
        selectedTier: formData.selectedTier as any,
      });
      // registerOrganization handles redirect
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {['company', 'admin', 'plan'].map((s, index) => (
        <div key={s} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s
                ? 'bg-indigo-600 text-white'
                : ['company', 'admin', 'plan'].indexOf(step) > index
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {['company', 'admin', 'plan'].indexOf(step) > index ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              index + 1
            )}
          </div>
          {index < 2 && (
            <div
              className={`w-16 h-1 mx-2 ${
                ['company', 'admin', 'plan'].indexOf(step) > index ? 'bg-green-500' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderCompanyStep = () => (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Company Information</h2>
        <p className="text-sm text-gray-500 mt-1">Tell us about your organization</p>
      </div>

      <div>
        <label htmlFor="companyName" className="label">
          Company Name <span className="text-red-500">*</span>
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          required
          value={formData.companyName}
          onChange={handleChange}
          className="input"
          placeholder="Acme Inc."
        />
      </div>

      <div>
        <label htmlFor="subdomain" className="label">
          Subdomain
        </label>
        <div className="flex items-center">
          <input
            id="subdomain"
            name="subdomain"
            type="text"
            value={formData.subdomain}
            onChange={handleChange}
            className="input rounded-r-none"
            placeholder="acme"
          />
          <span className="bg-gray-100 dark:bg-gray-700 px-3 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg text-sm text-gray-500">
            .theshepherd.io
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="industry" className="label">
            Industry
          </label>
          <select
            id="industry"
            name="industry"
            value={formData.industry}
            onChange={handleChange}
            className="input"
          >
            <option value="">Select industry</option>
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="companySize" className="label">
            Company Size
          </label>
          <select
            id="companySize"
            name="companySize"
            value={formData.companySize}
            onChange={handleChange}
            className="input"
          >
            <option value="">Select size</option>
            {COMPANY_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt} employees
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderAdminStep = () => (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Admin Account</h2>
        <p className="text-sm text-gray-500 mt-1">Create your administrator account</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="label">
            First Name <span className="text-red-500">*</span>
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            value={formData.firstName}
            onChange={handleChange}
            className="input"
            placeholder="John"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="label">
            Last Name <span className="text-red-500">*</span>
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            value={formData.lastName}
            onChange={handleChange}
            className="input"
            placeholder="Doe"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="label">
          Work Email <span className="text-red-500">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={formData.email}
          onChange={handleChange}
          className="input"
          placeholder="john@acme.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password <span className="text-red-500">*</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={formData.password}
          onChange={handleChange}
          className="input"
          placeholder="At least 8 characters"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="label">
          Confirm Password <span className="text-red-500">*</span>
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={formData.confirmPassword}
          onChange={handleChange}
          className="input"
          placeholder="Confirm your password"
        />
      </div>
    </div>
  );

  const renderPlanStep = () => (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Choose Your Plan</h2>
        <p className="text-sm text-gray-500 mt-1">Start with a 14-day free trial, upgrade anytime</p>
      </div>

      <div className="grid gap-4">
        {/* Trial Plan */}
        <label
          className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
            formData.selectedTier === 'trial'
              ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
          }`}
        >
          <input
            type="radio"
            name="selectedTier"
            value="trial"
            checked={formData.selectedTier === 'trial'}
            onChange={handleChange}
            className="sr-only"
          />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">Free Trial</span>
                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">$0</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">14-day trial, up to 10 employees</p>
            <ul className="text-xs text-gray-500 mt-2 space-y-1">
              <li>- Basic burnout monitoring</li>
              <li>- Personal dashboards</li>
              <li>- Team overview</li>
            </ul>
          </div>
          {formData.selectedTier === 'trial' && (
            <div className="absolute top-4 right-4 text-indigo-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </label>

        {/* Show loaded tiers if available */}
        {tiers.filter(t => t.id !== 'trial').map((tier) => (
          <label
            key={tier.id}
            className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
              formData.selectedTier === tier.id
                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="selectedTier"
              value={tier.id}
              checked={formData.selectedTier === tier.id}
              onChange={handleChange}
              className="sr-only"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900 dark:text-white">{tier.name}</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {tier.pricePerEmployee ? `$${tier.pricePerEmployee}/user/mo` : 'Contact us'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Up to {tier.maxEmployees === Infinity ? 'unlimited' : tier.maxEmployees} employees
              </p>
              <ul className="text-xs text-gray-500 mt-2 space-y-1">
                {tier.features.slice(0, 3).map((f, i) => (
                  <li key={i}>- {f}</li>
                ))}
              </ul>
            </div>
            {formData.selectedTier === tier.id && (
              <div className="absolute top-4 right-4 text-indigo-600">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </label>
        ))}
      </div>

      <p className="text-xs text-center text-gray-500">
        You can upgrade or change your plan at any time from the billing settings.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <LogoFull />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Get Started with ShepHerd</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Set up your organization in minutes
          </p>
        </div>

        {renderStepIndicator()}

        <div className="card">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {step === 'company' && renderCompanyStep()}
          {step === 'admin' && renderAdminStep()}
          {step === 'plan' && renderPlanStep()}

          <div className="mt-6 flex gap-3">
            {step !== 'company' && (
              <button
                type="button"
                onClick={handlePrevStep}
                className="btn btn-secondary flex-1"
                disabled={isSubmitting}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={handleNextStep}
              disabled={isSubmitting}
              className="btn btn-primary flex-1"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </span>
              ) : step === 'plan' ? (
                'Create Organization'
              ) : (
                'Continue'
              )}
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
