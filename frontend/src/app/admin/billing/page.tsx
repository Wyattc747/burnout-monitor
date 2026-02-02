'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { clsx } from 'clsx';
import type { SubscriptionInfo, Invoice } from '@/types';
import {
  CreditCard,
  Building2,
  Users,
  Calendar,
  FileText,
  ExternalLink,
  Download,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

export default function AdminBillingPage() {
  const { user, isLoading: authLoading } = useRequireAuth({
    requiredPermission: 'billing:read',
    redirectTo: '/dashboard',
  });

  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch subscription info
  const {
    data: subscription,
    isLoading: subscriptionLoading,
    error: subscriptionError,
  } = useQuery<SubscriptionInfo>({
    queryKey: ['subscription'],
    queryFn: billingApi.getSubscription,
    enabled: !authLoading && !!user,
  });

  // Fetch invoices
  const {
    data: invoicesData,
    isLoading: invoicesLoading,
    error: invoicesError,
  } = useQuery<{ invoices: Invoice[] }>({
    queryKey: ['invoices'],
    queryFn: () => billingApi.getInvoices(10),
    enabled: !authLoading && !!user,
  });

  const handleUpgrade = async () => {
    setError(null);
    setCheckoutLoading(true);
    try {
      const result = await billingApi.createCheckout(
        'professional',
        `${window.location.origin}/admin/billing?success=true`,
        `${window.location.origin}/admin/billing?canceled=true`
      );
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create checkout session');
      setCheckoutLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setError(null);
    setPortalLoading(true);
    try {
      const result = await billingApi.createPortal(
        `${window.location.origin}/admin/billing`
      );
      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open billing portal');
      setPortalLoading(false);
    }
  };

  if (authLoading || subscriptionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (subscriptionError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <p className="text-red-800 dark:text-red-200">
            Failed to load billing information. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  const isOnTrial = subscription?.status === 'trialing';
  const hasSubscription = subscription?.subscription?.id;
  const trialEndsAt = subscription?.trialEndsAt
    ? new Date(subscription.trialEndsAt)
    : null;
  const daysLeftInTrial = trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const usagePercentage = subscription
    ? Math.min(100, (subscription.currentEmployees / subscription.maxEmployees) * 100)
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'trialing':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20';
      case 'past_due':
        return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
      case 'canceled':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getInvoiceStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'open':
      case 'draft':
        return <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            Billing & Subscription
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your subscription and view billing history
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        {/* Trial Banner */}
        {isOnTrial && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800 dark:text-blue-200">
                    Trial Period Active
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {daysLeftInTrial > 0
                      ? `${daysLeftInTrial} day${daysLeftInTrial !== 1 ? 's' : ''} remaining until ${formatDate(subscription?.trialEndsAt || '')}`
                      : 'Your trial has ended'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {checkoutLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    Upgrade Now
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Current Plan Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Current Plan
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Tier */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Plan</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                {subscription?.tierInfo?.name || subscription?.tier || 'Free'}
              </p>
            </div>

            {/* Status */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Status</p>
              <span
                className={clsx(
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium capitalize',
                  getStatusColor(subscription?.status || '')
                )}
              >
                {subscription?.status === 'trialing' ? 'Trial' : subscription?.status || 'Unknown'}
              </span>
            </div>

            {/* Price */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Price</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {subscription?.tierInfo?.pricePerEmployee
                  ? `$${subscription.tierInfo.pricePerEmployee}/user/mo`
                  : 'Free'}
              </p>
            </div>

            {/* Billing Period */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Billing Period</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {subscription?.subscription?.currentPeriodEnd
                  ? `Renews ${formatDate(subscription.subscription.currentPeriodEnd)}`
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {hasSubscription ? (
              <button
                onClick={handleManageBilling}
                disabled={portalLoading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {portalLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Opening...
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Manage Billing
                  </>
                )}
              </button>
            ) : (
              !isOnTrial && (
                <button
                  onClick={handleUpgrade}
                  disabled={checkoutLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {checkoutLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Subscribe Now
                    </>
                  )}
                </button>
              )
            )}
          </div>
        </div>

        {/* Usage Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Usage
          </h2>

          <div className="space-y-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">Employees</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {subscription?.currentEmployees || 0} / {subscription?.maxEmployees || 0}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  usagePercentage >= 90
                    ? 'bg-red-500'
                    : usagePercentage >= 75
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                )}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              {usagePercentage >= 90 ? (
                <span className="text-red-600 dark:text-red-400">
                  You are approaching your employee limit. Consider upgrading your plan.
                </span>
              ) : usagePercentage >= 75 ? (
                <span className="text-amber-600 dark:text-amber-400">
                  You have used {Math.round(usagePercentage)}% of your employee limit.
                </span>
              ) : (
                `${subscription?.maxEmployees ? subscription.maxEmployees - (subscription?.currentEmployees || 0) : 0} employee slots remaining`
              )}
            </p>
          </div>
        </div>

        {/* Invoice History */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Invoice History
          </h2>

          {invoicesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600"></div>
            </div>
          ) : invoicesError ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Failed to load invoices
            </div>
          ) : !invoicesData?.invoices?.length ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No invoices yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Date
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Invoice
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Amount
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Status
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoicesData.invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                        {formatDate(invoice.created)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {invoice.number || `INV-${invoice.id.slice(-8)}`}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(invoice.amountPaid || invoice.amountDue, invoice.currency)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 text-sm capitalize">
                          {getInvoiceStatusIcon(invoice.status)}
                          <span
                            className={clsx(
                              invoice.status === 'paid'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : invoice.status === 'open'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-gray-600 dark:text-gray-400'
                            )}
                          >
                            {invoice.status}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {invoice.hostedInvoiceUrl && (
                            <a
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                              title="View Invoice"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          {invoice.invoicePdf && (
                            <a
                              href={invoice.invoicePdf}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Plan Features */}
        {subscription?.tierInfo?.features && subscription.tierInfo.features.length > 0 && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Plan Features
            </h2>
            <ul className="grid sm:grid-cols-2 gap-3">
              {subscription.tierInfo.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}
    </div>
  );
}
