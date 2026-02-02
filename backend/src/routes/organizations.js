const express = require('express');
const db = require('../utils/db');
const { authenticate, requireAdmin, requirePermission } = require('../middleware/auth');
const { requireOrganization, requireActiveSubscription, logAuditAction } = require('../middleware/tenant');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/organizations/current - Get current organization
router.get('/current', requireOrganization, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, slug, domain, logo_url, primary_color,
              subscription_tier, subscription_status, trial_ends_at,
              max_employees, settings, industry, company_size,
              created_at, updated_at
       FROM organizations WHERE id = $1`,
      [req.user.organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Organization not found' });
    }

    const org = result.rows[0];

    res.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      domain: org.domain,
      logoUrl: org.logo_url,
      primaryColor: org.primary_color,
      subscriptionTier: org.subscription_tier,
      subscriptionStatus: org.subscription_status,
      trialEndsAt: org.trial_ends_at,
      maxEmployees: org.max_employees,
      settings: org.settings,
      industry: org.industry,
      companySize: org.company_size,
      createdAt: org.created_at,
      updatedAt: org.updated_at,
    });
  } catch (err) {
    console.error('Get organization error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get organization' });
  }
});

// PUT /api/organizations/current - Update organization settings
router.put('/current', requireOrganization, requirePermission('org:update'), async (req, res) => {
  try {
    const { name, domain, logoUrl, primaryColor, settings, industry, companySize } = req.body;

    // Get current values for audit
    const currentResult = await db.query(
      'SELECT name, domain, logo_url, primary_color, settings, industry, company_size FROM organizations WHERE id = $1',
      [req.user.organizationId]
    );
    const currentOrg = currentResult.rows[0];

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (domain !== undefined) {
      updates.push(`domain = $${paramIndex++}`);
      values.push(domain ? domain.toLowerCase().trim() : null);
    }
    if (logoUrl !== undefined) {
      updates.push(`logo_url = $${paramIndex++}`);
      values.push(logoUrl);
    }
    if (primaryColor !== undefined) {
      updates.push(`primary_color = $${paramIndex++}`);
      values.push(primaryColor);
    }
    if (settings !== undefined) {
      updates.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(settings));
    }
    if (industry !== undefined) {
      updates.push(`industry = $${paramIndex++}`);
      values.push(industry);
    }
    if (companySize !== undefined) {
      const validSizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
      if (!validSizes.includes(companySize)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Invalid company size' });
      }
      updates.push(`company_size = $${paramIndex++}`);
      values.push(companySize);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Validation Error', message: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.user.organizationId);

    const result = await db.query(
      `UPDATE organizations SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    const org = result.rows[0];

    // Log audit action
    await logAuditAction(
      req,
      'organization.updated',
      'organization',
      org.id,
      currentOrg,
      { name, domain, logoUrl, primaryColor, settings, industry, companySize }
    );

    res.json({
      id: org.id,
      name: org.name,
      slug: org.slug,
      domain: org.domain,
      logoUrl: org.logo_url,
      primaryColor: org.primary_color,
      subscriptionTier: org.subscription_tier,
      subscriptionStatus: org.subscription_status,
      settings: org.settings,
      industry: org.industry,
      companySize: org.company_size,
      updatedAt: org.updated_at,
    });
  } catch (err) {
    console.error('Update organization error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update organization' });
  }
});

// GET /api/organizations/current/stats - Get organization dashboard statistics
router.get('/current/stats', requireOrganization, requirePermission('org:read'), async (req, res) => {
  try {
    const orgId = req.user.organizationId;

    // Get employee counts by status
    const employeeStats = await db.query(
      `SELECT
        COUNT(*) FILTER (WHERE employment_status = 'active') as active_employees,
        COUNT(*) FILTER (WHERE employment_status = 'pending') as pending_employees,
        COUNT(*) FILTER (WHERE employment_status = 'on_leave') as on_leave_employees,
        COUNT(*) as total_employees
       FROM employees WHERE organization_id = $1`,
      [orgId]
    );

    // Get department count
    const deptCount = await db.query(
      'SELECT COUNT(*) as count FROM departments WHERE organization_id = $1 AND is_active = true',
      [orgId]
    );

    // Get pending invitations
    const inviteCount = await db.query(
      `SELECT COUNT(*) as count FROM employee_invitations
       WHERE organization_id = $1 AND status = 'pending' AND expires_at > NOW()`,
      [orgId]
    );

    // Get zone distribution (from recent zone_history)
    const zoneStats = await db.query(
      `SELECT zh.zone, COUNT(DISTINCT zh.employee_id) as count
       FROM zone_history zh
       JOIN employees e ON zh.employee_id = e.id
       WHERE e.organization_id = $1
         AND zh.date = (SELECT MAX(date) FROM zone_history WHERE employee_id = zh.employee_id)
         AND e.employment_status = 'active'
       GROUP BY zh.zone`,
      [orgId]
    );

    // Get recent alerts count
    const alertCount = await db.query(
      `SELECT COUNT(*) as count FROM alerts a
       JOIN employees e ON a.employee_id = e.id
       WHERE e.organization_id = $1 AND a.is_acknowledged = false`,
      [orgId]
    );

    // Get active challenges count
    const challengeCount = await db.query(
      `SELECT COUNT(*) as count FROM challenges c
       JOIN employees e ON c.created_by = e.id
       WHERE e.organization_id = $1 AND c.status = 'active'`,
      [orgId]
    );

    // Get subscription info
    const orgInfo = await db.query(
      `SELECT max_employees, subscription_tier, subscription_status, trial_ends_at
       FROM organizations WHERE id = $1`,
      [orgId]
    );

    const stats = employeeStats.rows[0];
    const zones = {};
    zoneStats.rows.forEach(row => {
      zones[row.zone] = parseInt(row.count);
    });

    res.json({
      employees: {
        total: parseInt(stats.total_employees),
        active: parseInt(stats.active_employees),
        pending: parseInt(stats.pending_employees),
        onLeave: parseInt(stats.on_leave_employees),
      },
      departments: parseInt(deptCount.rows[0].count),
      pendingInvitations: parseInt(inviteCount.rows[0].count),
      zones: {
        red: zones.red || 0,
        yellow: zones.yellow || 0,
        green: zones.green || 0,
      },
      unacknowledgedAlerts: parseInt(alertCount.rows[0].count),
      activeChallenges: parseInt(challengeCount.rows[0].count),
      subscription: {
        tier: orgInfo.rows[0].subscription_tier,
        status: orgInfo.rows[0].subscription_status,
        maxEmployees: orgInfo.rows[0].max_employees,
        trialEndsAt: orgInfo.rows[0].trial_ends_at,
      },
    });
  } catch (err) {
    console.error('Get organization stats error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get organization statistics' });
  }
});

// GET /api/organizations/current/activity - Get recent activity
router.get('/current/activity', requireOrganization, requirePermission('audit:read'), async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const result = await db.query(
      `SELECT id, user_id, user_email, action, resource_type, resource_id,
              old_values, new_values, ip_address, created_at
       FROM organization_audit_logs
       WHERE organization_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.organizationId, Math.min(parseInt(limit), 100), parseInt(offset)]
    );

    const countResult = await db.query(
      'SELECT COUNT(*) FROM organization_audit_logs WHERE organization_id = $1',
      [req.user.organizationId]
    );

    res.json({
      activities: result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        userEmail: row.user_email,
        action: row.action,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        oldValues: row.old_values,
        newValues: row.new_values,
        ipAddress: row.ip_address,
        createdAt: row.created_at,
      })),
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('Get activity log error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get activity log' });
  }
});

module.exports = router;
