/**
 * Billing Service
 *
 * Handles Stripe subscription management and billing operations.
 */

const db = require('../utils/db');

// Stripe will be lazily initialized when needed
let stripe = null;

function getStripe() {
  if (!stripe) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    stripe = require('stripe')(stripeKey);
  }
  return stripe;
}

// Subscription tier configuration
const TIERS = {
  trial: {
    name: 'Trial',
    priceId: null, // Free
    maxEmployees: 10,
    features: ['Basic burnout monitoring', 'Personal dashboard', '14-day trial'],
  },
  starter: {
    name: 'Starter',
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    pricePerEmployee: 5,
    maxEmployees: 50,
    features: [
      'All trial features',
      'Team dashboard',
      'Manager alerts',
      'Basic integrations',
      'Email support',
    ],
  },
  professional: {
    name: 'Professional',
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
    pricePerEmployee: 8,
    maxEmployees: 500,
    features: [
      'All starter features',
      'HR integrations',
      'Advanced analytics',
      'Custom thresholds',
      'API access',
      'Priority support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    pricePerEmployee: null, // Custom pricing
    maxEmployees: Infinity,
    features: [
      'All professional features',
      'SSO/SAML',
      'Dedicated support',
      'Custom integrations',
      'SLA guarantee',
      'Data residency options',
    ],
  },
};

/**
 * Get subscription tier info
 * @param {string} tier - Tier name
 * @returns {Object}
 */
function getTierInfo(tier) {
  return TIERS[tier] || TIERS.trial;
}

/**
 * Get all available tiers
 * @returns {Array}
 */
function getAllTiers() {
  return Object.entries(TIERS).map(([id, info]) => ({
    id,
    ...info,
  }));
}

/**
 * Create or get Stripe customer for organization
 * @param {string} organizationId - Organization ID
 * @returns {Promise<string>} Stripe customer ID
 */
async function getOrCreateStripeCustomer(organizationId) {
  const s = getStripe();

  // Get organization
  const orgResult = await db.query(
    'SELECT id, name, stripe_customer_id FROM organizations WHERE id = $1',
    [organizationId]
  );

  if (orgResult.rows.length === 0) {
    throw new Error('Organization not found');
  }

  const org = orgResult.rows[0];

  // Return existing customer if we have one
  if (org.stripe_customer_id) {
    return org.stripe_customer_id;
  }

  // Get super admin email for customer
  const adminResult = await db.query(
    `SELECT u.email FROM users u
     WHERE u.organization_id = $1 AND u.role IN ('super_admin', 'admin')
     ORDER BY u.created_at ASC LIMIT 1`,
    [organizationId]
  );

  const adminEmail = adminResult.rows[0]?.email;

  // Create Stripe customer
  const customer = await s.customers.create({
    name: org.name,
    email: adminEmail,
    metadata: {
      organization_id: organizationId,
    },
  });

  // Save customer ID
  await db.query(
    'UPDATE organizations SET stripe_customer_id = $1 WHERE id = $2',
    [customer.id, organizationId]
  );

  return customer.id;
}

/**
 * Create Stripe checkout session for subscription
 * @param {string} organizationId - Organization ID
 * @param {string} tier - Subscription tier
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Checkout session
 */
async function createCheckoutSession(organizationId, tier, options = {}) {
  const s = getStripe();
  const tierInfo = getTierInfo(tier);

  if (!tierInfo.priceId) {
    throw new Error(`No price configured for tier: ${tier}`);
  }

  const customerId = await getOrCreateStripeCustomer(organizationId);

  const successUrl = options.successUrl || `${process.env.FRONTEND_URL}/admin/billing?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = options.cancelUrl || `${process.env.FRONTEND_URL}/admin/billing`;

  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: tierInfo.priceId,
        quantity: options.quantity || 1, // Per-employee pricing
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        organization_id: organizationId,
        tier,
      },
    },
    metadata: {
      organization_id: organizationId,
      tier,
    },
    allow_promotion_codes: true,
  });

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Create Stripe billing portal session
 * @param {string} organizationId - Organization ID
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Portal session
 */
async function createBillingPortalSession(organizationId, options = {}) {
  const s = getStripe();

  // Get organization's Stripe customer ID
  const orgResult = await db.query(
    'SELECT stripe_customer_id FROM organizations WHERE id = $1',
    [organizationId]
  );

  if (orgResult.rows.length === 0 || !orgResult.rows[0].stripe_customer_id) {
    throw new Error('No billing account found. Please set up a subscription first.');
  }

  const returnUrl = options.returnUrl || `${process.env.FRONTEND_URL}/admin/billing`;

  const session = await s.billingPortal.sessions.create({
    customer: orgResult.rows[0].stripe_customer_id,
    return_url: returnUrl,
  });

  return {
    url: session.url,
  };
}

/**
 * Get current subscription info
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>}
 */
async function getSubscriptionInfo(organizationId) {
  // Get organization
  const orgResult = await db.query(
    `SELECT stripe_customer_id, stripe_subscription_id, subscription_tier, subscription_status,
            trial_ends_at, max_employees
     FROM organizations WHERE id = $1`,
    [organizationId]
  );

  if (orgResult.rows.length === 0) {
    throw new Error('Organization not found');
  }

  const org = orgResult.rows[0];
  const tierInfo = getTierInfo(org.subscription_tier);

  // Get current employee count
  const countResult = await db.query(
    `SELECT COUNT(*) FROM employees WHERE organization_id = $1 AND employment_status = 'active'`,
    [organizationId]
  );
  const currentEmployees = parseInt(countResult.rows[0].count);

  const result = {
    tier: org.subscription_tier,
    tierInfo,
    status: org.subscription_status,
    trialEndsAt: org.trial_ends_at,
    maxEmployees: org.max_employees,
    currentEmployees,
    stripeCustomerId: org.stripe_customer_id,
  };

  // Get Stripe subscription details if we have one and Stripe is configured
  if (org.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const s = getStripe();
      const subscription = await s.subscriptions.retrieve(org.stripe_subscription_id);
      result.subscription = {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
      };
    } catch (err) {
      console.error('Error fetching Stripe subscription:', err);
    }
  }

  return result;
}

/**
 * Handle Stripe webhook events
 * @param {Object} event - Stripe event
 * @returns {Promise<Object>}
 */
async function handleWebhookEvent(event) {
  const s = getStripe();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const organizationId = session.metadata.organization_id;
      const tier = session.metadata.tier;

      if (session.mode === 'subscription') {
        // Get the subscription
        const subscription = await s.subscriptions.retrieve(session.subscription);
        const tierInfo = getTierInfo(tier);

        // Update organization
        await db.query(
          `UPDATE organizations SET
            stripe_subscription_id = $1,
            subscription_tier = $2,
            subscription_status = 'active',
            max_employees = $3,
            trial_ends_at = NULL
           WHERE id = $4`,
          [subscription.id, tier, tierInfo.maxEmployees, organizationId]
        );

        return { action: 'subscription_created', organizationId, tier };
      }
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;

      if (subscriptionId) {
        // Update subscription status
        await db.query(
          `UPDATE organizations SET subscription_status = 'active'
           WHERE stripe_subscription_id = $1`,
          [subscriptionId]
        );

        return { action: 'invoice_paid', subscriptionId };
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;

      if (subscriptionId) {
        // Update subscription status
        await db.query(
          `UPDATE organizations SET subscription_status = 'past_due'
           WHERE stripe_subscription_id = $1`,
          [subscriptionId]
        );

        return { action: 'payment_failed', subscriptionId };
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;

      // Map Stripe status to our status
      let status = subscription.status;
      if (status === 'incomplete_expired') status = 'canceled';

      await db.query(
        `UPDATE organizations SET subscription_status = $1
         WHERE stripe_subscription_id = $2`,
        [status, subscription.id]
      );

      return { action: 'subscription_updated', subscriptionId: subscription.id, status };
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;

      // Downgrade to trial tier
      await db.query(
        `UPDATE organizations SET
          subscription_tier = 'trial',
          subscription_status = 'canceled',
          stripe_subscription_id = NULL,
          max_employees = 10
         WHERE stripe_subscription_id = $1`,
        [subscription.id]
      );

      return { action: 'subscription_canceled', subscriptionId: subscription.id };
    }

    default:
      return { action: 'ignored', type: event.type };
  }

  return { action: 'processed', type: event.type };
}

/**
 * Update subscription quantity (for per-employee pricing)
 * @param {string} organizationId - Organization ID
 * @param {number} quantity - New employee count
 */
async function updateSubscriptionQuantity(organizationId, quantity) {
  const s = getStripe();

  const orgResult = await db.query(
    'SELECT stripe_subscription_id FROM organizations WHERE id = $1',
    [organizationId]
  );

  if (!orgResult.rows[0]?.stripe_subscription_id) {
    return; // No subscription to update
  }

  const subscriptionId = orgResult.rows[0].stripe_subscription_id;
  const subscription = await s.subscriptions.retrieve(subscriptionId);

  // Update the quantity on the subscription item
  await s.subscriptionItems.update(subscription.items.data[0].id, {
    quantity,
  });
}

/**
 * Check if organization can add more employees
 * @param {string} organizationId - Organization ID
 * @param {number} additionalCount - Number of employees to add
 * @returns {Promise<{allowed: boolean, current: number, max: number, message?: string}>}
 */
async function checkEmployeeLimit(organizationId, additionalCount = 1) {
  const result = await db.query(
    `SELECT o.max_employees,
            (SELECT COUNT(*) FROM employees WHERE organization_id = o.id AND employment_status = 'active') as current_count
     FROM organizations o WHERE o.id = $1`,
    [organizationId]
  );

  if (result.rows.length === 0) {
    return { allowed: false, message: 'Organization not found' };
  }

  const { max_employees, current_count } = result.rows[0];
  const current = parseInt(current_count);
  const max = parseInt(max_employees);

  if (current + additionalCount > max) {
    return {
      allowed: false,
      current,
      max,
      message: `Employee limit reached (${current}/${max}). Please upgrade your plan.`,
    };
  }

  return { allowed: true, current, max };
}

module.exports = {
  getTierInfo,
  getAllTiers,
  getOrCreateStripeCustomer,
  createCheckoutSession,
  createBillingPortalSession,
  getSubscriptionInfo,
  handleWebhookEvent,
  updateSubscriptionQuantity,
  checkEmployeeLimit,
  TIERS,
};
