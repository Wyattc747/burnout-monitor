const express = require('express');
const db = require('../utils/db');
const { authenticate, requirePermission, requireSuperAdmin } = require('../middleware/auth');
const { requireOrganization, logAuditAction } = require('../middleware/tenant');
const billingService = require('../services/billing');

const router = express.Router();

// GET /api/billing - Get subscription info (requires auth)
router.get('/', authenticate, requireOrganization, requirePermission('billing:read'), async (req, res) => {
  try {
    const info = await billingService.getSubscriptionInfo(req.user.organizationId);
    res.json(info);
  } catch (err) {
    console.error('Get billing info error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get billing information' });
  }
});

// GET /api/billing/tiers - Get available subscription tiers (public)
router.get('/tiers', async (req, res) => {
  try {
    const tiers = billingService.getAllTiers();
    res.json({ tiers });
  } catch (err) {
    console.error('Get tiers error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get subscription tiers' });
  }
});

// POST /api/billing/checkout - Create Stripe checkout session
router.post('/checkout', authenticate, requireOrganization, requirePermission('billing:update'), async (req, res) => {
  try {
    const { tier, successUrl, cancelUrl } = req.body;

    if (!tier) {
      return res.status(400).json({ error: 'Validation Error', message: 'Subscription tier is required' });
    }

    const tierInfo = billingService.getTierInfo(tier);
    if (!tierInfo.priceId) {
      return res.status(400).json({ error: 'Validation Error', message: 'Invalid subscription tier' });
    }

    // Get current employee count for per-seat pricing
    const countResult = await db.query(
      `SELECT COUNT(*) FROM employees WHERE organization_id = $1 AND employment_status = 'active'`,
      [req.user.organizationId]
    );
    const employeeCount = Math.max(1, parseInt(countResult.rows[0].count));

    const session = await billingService.createCheckoutSession(req.user.organizationId, tier, {
      successUrl,
      cancelUrl,
      quantity: employeeCount,
    });

    // Log audit action
    await logAuditAction(req, 'billing.checkout_started', 'billing', null, null, { tier, employeeCount });

    res.json(session);
  } catch (err) {
    console.error('Create checkout error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to create checkout session' });
  }
});

// POST /api/billing/portal - Create Stripe billing portal session
router.post('/portal', authenticate, requireOrganization, requirePermission('billing:read'), async (req, res) => {
  try {
    const { returnUrl } = req.body;

    const session = await billingService.createBillingPortalSession(req.user.organizationId, {
      returnUrl,
    });

    res.json(session);
  } catch (err) {
    console.error('Create portal error:', err);

    if (err.message.includes('No billing account')) {
      return res.status(400).json({ error: 'No Subscription', message: err.message });
    }

    res.status(500).json({ error: 'Server Error', message: 'Failed to create billing portal session' });
  }
});

// POST /api/billing/webhook - Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const sig = req.headers['stripe-signature'];

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    console.log(`Processing Stripe webhook: ${event.type}`);

    const result = await billingService.handleWebhookEvent(event);

    console.log(`Webhook result:`, result);

    res.json({ received: true, result });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({ error: 'Webhook Error', message: err.message });
  }
});

// GET /api/billing/usage - Get usage statistics
router.get('/usage', authenticate, requireOrganization, requirePermission('billing:read'), async (req, res) => {
  try {
    const orgId = req.user.organizationId;

    // Get organization limits
    const orgResult = await db.query(
      'SELECT max_employees, subscription_tier FROM organizations WHERE id = $1',
      [orgId]
    );

    const org = orgResult.rows[0];

    // Get employee counts
    const employeeResult = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE employment_status = 'active') as active,
        COUNT(*) FILTER (WHERE employment_status = 'pending') as pending,
        COUNT(*) FILTER (WHERE employment_status = 'on_leave') as on_leave,
        COUNT(*) as total
       FROM employees WHERE organization_id = $1`,
      [orgId]
    );

    const counts = employeeResult.rows[0];

    // Get pending invitations
    const inviteResult = await db.query(
      `SELECT COUNT(*) FROM employee_invitations
       WHERE organization_id = $1 AND status = 'pending' AND expires_at > NOW()`,
      [orgId]
    );

    res.json({
      employees: {
        active: parseInt(counts.active),
        pending: parseInt(counts.pending),
        onLeave: parseInt(counts.on_leave),
        total: parseInt(counts.total),
      },
      pendingInvitations: parseInt(inviteResult.rows[0].count),
      limits: {
        maxEmployees: org.max_employees,
        remainingSlots: Math.max(0, org.max_employees - parseInt(counts.active)),
      },
      tier: org.subscription_tier,
    });
  } catch (err) {
    console.error('Get usage error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get usage statistics' });
  }
});

// POST /api/billing/check-limit - Check if can add employees
router.post('/check-limit', authenticate, requireOrganization, async (req, res) => {
  try {
    const { count = 1 } = req.body;

    const result = await billingService.checkEmployeeLimit(req.user.organizationId, count);

    res.json(result);
  } catch (err) {
    console.error('Check limit error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to check employee limit' });
  }
});

// GET /api/billing/invoices - Get invoice history (from Stripe)
router.get('/invoices', authenticate, requireOrganization, requirePermission('billing:read'), async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    // Get Stripe customer ID
    const orgResult = await db.query(
      'SELECT stripe_customer_id FROM organizations WHERE id = $1',
      [req.user.organizationId]
    );

    const customerId = orgResult.rows[0]?.stripe_customer_id;

    if (!customerId) {
      return res.json({ invoices: [] });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: Math.min(parseInt(limit), 100),
    });

    res.json({
      invoices: invoices.data.map(inv => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amountDue: inv.amount_due,
        amountPaid: inv.amount_paid,
        currency: inv.currency,
        created: new Date(inv.created * 1000),
        periodStart: new Date(inv.period_start * 1000),
        periodEnd: new Date(inv.period_end * 1000),
        invoicePdf: inv.invoice_pdf,
        hostedInvoiceUrl: inv.hosted_invoice_url,
      })),
    });
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get invoices' });
  }
});

module.exports = router;
