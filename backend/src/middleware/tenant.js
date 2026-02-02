const pool = require('../utils/db');

/**
 * Tenant middleware for multi-tenancy support
 *
 * This middleware:
 * 1. Extracts organization context from JWT token (set by auth middleware)
 * 2. Sets PostgreSQL session variables for Row Level Security (RLS)
 * 3. Validates tenant access
 */

/**
 * Set tenant context for Row Level Security
 * Must be called after authenticate middleware
 */
async function setTenantContext(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required for tenant context',
    });
  }

  // If user has no organization (shouldn't happen with proper auth flow)
  if (!req.user.organizationId) {
    // Allow demo accounts without org for backwards compatibility
    if (req.user.isDemoAccount) {
      return next();
    }
    return res.status(403).json({
      error: 'Forbidden',
      message: 'No organization context. Please contact support.',
    });
  }

  try {
    // Get a client from the pool for this request
    const client = await pool.getClient();

    // Set session variables for RLS policies
    await client.query(
      `SELECT set_config('app.current_organization_id', $1, true)`,
      [req.user.organizationId]
    );
    await client.query(
      `SELECT set_config('app.current_user_id', $1, true)`,
      [req.user.userId]
    );
    await client.query(
      `SELECT set_config('app.current_user_role', $1, true)`,
      [req.user.role]
    );

    // Attach the client to the request for use in route handlers
    req.dbClient = client;

    // Release the client when the response finishes
    res.on('finish', () => {
      client.release();
    });

    // Also release on error
    res.on('error', () => {
      client.release();
    });

    next();
  } catch (error) {
    console.error('Error setting tenant context:', error);
    return res.status(500).json({
      error: 'Server Error',
      message: 'Failed to establish tenant context',
    });
  }
}

/**
 * Middleware to ensure user belongs to an organization
 */
function requireOrganization(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  if (!req.user.organizationId) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This action requires organization membership',
    });
  }

  next();
}

/**
 * Middleware to check if organization subscription is active
 */
async function requireActiveSubscription(req, res, next) {
  if (!req.user || !req.user.organizationId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication and organization membership required',
    });
  }

  try {
    const result = await pool.query(
      `SELECT subscription_status, subscription_tier, trial_ends_at
       FROM organizations WHERE id = $1`,
      [req.user.organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Organization not found',
      });
    }

    const org = result.rows[0];

    // Check subscription status
    if (org.subscription_status === 'canceled') {
      return res.status(402).json({
        error: 'Payment Required',
        message: 'Your subscription has been canceled. Please reactivate to continue.',
        code: 'SUBSCRIPTION_CANCELED',
      });
    }

    // Check if trial has expired
    if (
      org.subscription_tier === 'trial' &&
      org.trial_ends_at &&
      new Date(org.trial_ends_at) < new Date()
    ) {
      return res.status(402).json({
        error: 'Payment Required',
        message: 'Your trial has expired. Please upgrade to continue.',
        code: 'TRIAL_EXPIRED',
      });
    }

    // Check past due status (allow access but warn)
    if (org.subscription_status === 'past_due') {
      res.set('X-Subscription-Warning', 'past_due');
    }

    // Attach org info to request for downstream use
    req.organization = {
      subscriptionStatus: org.subscription_status,
      subscriptionTier: org.subscription_tier,
      trialEndsAt: org.trial_ends_at,
    };

    next();
  } catch (error) {
    console.error('Error checking subscription:', error);
    return res.status(500).json({
      error: 'Server Error',
      message: 'Failed to verify subscription status',
    });
  }
}

/**
 * Middleware to check employee limits
 */
async function checkEmployeeLimit(req, res, next) {
  if (!req.user || !req.user.organizationId) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication and organization membership required',
    });
  }

  try {
    const result = await pool.query(
      `SELECT
        o.max_employees,
        COUNT(e.id)::integer as current_employees
       FROM organizations o
       LEFT JOIN employees e ON e.organization_id = o.id AND e.employment_status = 'active'
       WHERE o.id = $1
       GROUP BY o.id`,
      [req.user.organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Organization not found',
      });
    }

    const { max_employees, current_employees } = result.rows[0];

    if (current_employees >= max_employees) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Employee limit reached (${current_employees}/${max_employees}). Please upgrade your plan.`,
        code: 'EMPLOYEE_LIMIT_REACHED',
        data: { currentEmployees: current_employees, maxEmployees: max_employees },
      });
    }

    // Attach limits to request for downstream use
    req.employeeLimits = {
      current: current_employees,
      max: max_employees,
      remaining: max_employees - current_employees,
    };

    next();
  } catch (error) {
    console.error('Error checking employee limit:', error);
    return res.status(500).json({
      error: 'Server Error',
      message: 'Failed to check employee limits',
    });
  }
}

/**
 * Extract organization from various sources (subdomain, header, JWT)
 * Useful for public endpoints that need org context
 */
async function extractOrganization(req, res, next) {
  let orgSlug = null;

  // 1. Check JWT token (highest priority)
  if (req.user && req.user.organizationSlug) {
    orgSlug = req.user.organizationSlug;
  }

  // 2. Check X-Organization header
  if (!orgSlug && req.headers['x-organization']) {
    orgSlug = req.headers['x-organization'];
  }

  // 3. Check subdomain (e.g., acme.shepherd.com)
  if (!orgSlug && req.hostname) {
    const parts = req.hostname.split('.');
    if (parts.length > 2 && parts[0] !== 'www' && parts[0] !== 'api') {
      orgSlug = parts[0];
    }
  }

  if (orgSlug) {
    try {
      const result = await pool.query(
        `SELECT id, name, slug, logo_url, subscription_tier, settings
         FROM organizations WHERE slug = $1`,
        [orgSlug]
      );

      if (result.rows.length > 0) {
        req.organization = {
          id: result.rows[0].id,
          name: result.rows[0].name,
          slug: result.rows[0].slug,
          logoUrl: result.rows[0].logo_url,
          subscriptionTier: result.rows[0].subscription_tier,
          settings: result.rows[0].settings,
        };
      }
    } catch (error) {
      console.error('Error extracting organization:', error);
    }
  }

  next();
}

/**
 * Log admin action for audit trail
 */
async function logAuditAction(req, action, resourceType, resourceId, oldValues, newValues) {
  if (!req.user || !req.user.organizationId) {
    return;
  }

  try {
    await pool.query(
      `INSERT INTO organization_audit_logs
        (organization_id, user_id, user_email, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        req.user.organizationId,
        req.user.userId,
        req.user.email,
        action,
        resourceType,
        resourceId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        req.ip || req.connection?.remoteAddress,
        req.get('User-Agent'),
      ]
    );
  } catch (error) {
    console.error('Error logging audit action:', error);
    // Don't throw - audit logging shouldn't break the main operation
  }
}

module.exports = {
  setTenantContext,
  requireOrganization,
  requireActiveSubscription,
  checkEmployeeLimit,
  extractOrganization,
  logAuditAction,
};
