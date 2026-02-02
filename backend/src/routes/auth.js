const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../utils/db');
const { authenticate, generateToken } = require('../middleware/auth');
const { validate, loginSchema, registerSchema } = require('../middleware/validate');
const { logAuditAction } = require('../middleware/tenant');

const router = express.Router();

// Demo organization ID (fixed UUID from migration)
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_DEPT_ID = '00000000-0000-0000-0000-000000000002';

// Helper to generate URL-friendly slug from company name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

// Helper to generate secure random token
function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user with organization info
    const userResult = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.role, u.organization_id, u.is_demo_account,
              o.slug as organization_slug, o.name as organization_name
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    }

    // Get employee ID for all users (managers also have employee records)
    let employeeId = null;
    const empResult = await db.query(
      'SELECT id FROM employees WHERE user_id = $1',
      [user.id]
    );
    if (empResult.rows.length > 0) {
      employeeId = empResult.rows[0].id;
    }

    // Generate token with organization context
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId,
      organizationId: user.organization_id,
      organizationSlug: user.organization_slug,
      isDemoAccount: user.is_demo_account,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        organizationSlug: user.organization_slug,
        organizationName: user.organization_name,
        isDemoAccount: user.is_demo_account,
      },
      employeeId,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Login failed' });
  }
});

// POST /api/auth/register - Now for demo accounts or individual signups only
router.post('/register', validate(registerSchema), async (req, res) => {
  const client = await db.getClient();
  try {
    const { email, password, firstName, lastName, department, jobTitle } = req.body;

    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      client.release();
      return res.status(400).json({
        error: 'Validation Error',
        message: 'An account with this email already exists',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Begin transaction for user + employee + baselines creation
    await client.query('BEGIN');

    // Create user in demo organization
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, organization_id, is_demo_account)
       VALUES ($1, $2, 'employee', $3, true)
       RETURNING id, email, role, organization_id, is_demo_account`,
      [email.toLowerCase(), passwordHash, DEMO_ORG_ID]
    );

    const user = userResult.rows[0];

    // Create employee record in demo organization
    const empResult = await client.query(
      `INSERT INTO employees (user_id, first_name, last_name, email, department, job_title, hire_date, organization_id, department_id, employment_status, onboarding_completed)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE, $7, $8, 'active', false)
       RETURNING id`,
      [user.id, firstName, lastName, email.toLowerCase(), department || 'General', jobTitle || 'Employee', DEMO_ORG_ID, DEMO_DEPT_ID]
    );

    const employeeId = empResult.rows[0].id;

    // Create default baselines
    await client.query(
      `INSERT INTO employee_baselines (employee_id, baseline_sleep_hours, baseline_sleep_quality, baseline_hrv, baseline_resting_hr, baseline_hours_worked)
       VALUES ($1, 7, 70, 45, 65, 8)`,
      [employeeId]
    );

    // Commit all changes
    await client.query('COMMIT');

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId,
      organizationId: DEMO_ORG_ID,
      organizationSlug: 'demo',
      isDemoAccount: true,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: DEMO_ORG_ID,
        organizationSlug: 'demo',
        isDemoAccount: true,
      },
      employeeId,
      message: 'Account created successfully',
    });
  } catch (err) {
    // Rollback on any error
    await client.query('ROLLBACK');
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Registration failed' });
  } finally {
    client.release();
  }
});

// POST /api/auth/register-organization - B2B signup
router.post('/register-organization', async (req, res) => {
  const client = await db.getClient();
  try {
    const {
      companyName,
      email,
      password,
      firstName,
      lastName,
      industry,
      companySize,
      subdomain, // Optional custom subdomain
    } = req.body;

    // Validation
    if (!companyName || !email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Company name, email, password, first name, and last name are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 8 characters',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'An account with this email already exists',
      });
    }

    // Generate slug (or use custom subdomain if provided)
    let slug = subdomain ? generateSlug(subdomain) : generateSlug(companyName);

    // Check if slug is unique, append number if not
    let slugAttempt = 0;
    let originalSlug = slug;
    while (true) {
      const existingOrg = await client.query(
        'SELECT id FROM organizations WHERE slug = $1',
        [slug]
      );
      if (existingOrg.rows.length === 0) break;
      slugAttempt++;
      slug = `${originalSlug}-${slugAttempt}`;
      if (slugAttempt > 100) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Could not generate unique organization URL. Please try a different name.',
        });
      }
    }

    // Extract domain from email for SSO matching later
    const emailDomain = normalizedEmail.split('@')[1];

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Begin transaction
    await client.query('BEGIN');

    // Calculate trial end date (14 days from now)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    // Create organization
    const orgResult = await client.query(
      `INSERT INTO organizations (name, slug, domain, industry, company_size, subscription_tier, subscription_status, trial_ends_at, max_employees)
       VALUES ($1, $2, $3, $4, $5, 'trial', 'trialing', $6, 10)
       RETURNING id, name, slug, subscription_tier, trial_ends_at`,
      [companyName.trim(), slug, emailDomain, industry || null, companySize || null, trialEndsAt]
    );

    const org = orgResult.rows[0];

    // Create default department
    const deptResult = await client.query(
      `INSERT INTO departments (organization_id, name, code, description, hierarchy_level)
       VALUES ($1, $2, 'GEN', 'Default department', 0)
       RETURNING id`,
      [org.id, companyName.trim()]
    );

    const defaultDeptId = deptResult.rows[0].id;

    // Create super_admin user
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, organization_id, is_demo_account)
       VALUES ($1, $2, 'super_admin', $3, false)
       RETURNING id, email, role, organization_id`,
      [normalizedEmail, passwordHash, org.id]
    );

    const user = userResult.rows[0];

    // Create employee record for super_admin
    const empResult = await client.query(
      `INSERT INTO employees (user_id, first_name, last_name, email, job_title, hire_date, organization_id, department_id, employment_status, hierarchy_level, onboarding_completed)
       VALUES ($1, $2, $3, $4, 'Administrator', CURRENT_DATE, $5, $6, 'active', 0, false)
       RETURNING id`,
      [user.id, firstName.trim(), lastName.trim(), normalizedEmail, org.id, defaultDeptId]
    );

    const employeeId = empResult.rows[0].id;

    // Set super_admin as department manager
    await client.query(
      'UPDATE departments SET manager_employee_id = $1 WHERE id = $2',
      [employeeId, defaultDeptId]
    );

    // Create default baselines
    await client.query(
      `INSERT INTO employee_baselines (employee_id, baseline_sleep_hours, baseline_sleep_quality, baseline_hrv, baseline_resting_hr, baseline_hours_worked)
       VALUES ($1, 7, 70, 45, 65, 8)`,
      [employeeId]
    );

    // Commit transaction
    await client.query('COMMIT');

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId,
      organizationId: org.id,
      organizationSlug: org.slug,
      isDemoAccount: false,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: org.id,
        organizationSlug: org.slug,
        organizationName: org.name,
        isDemoAccount: false,
      },
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        subscriptionTier: org.subscription_tier,
        trialEndsAt: org.trial_ends_at,
      },
      employeeId,
      message: 'Organization created successfully',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Organization registration error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Organization registration failed' });
  } finally {
    client.release();
  }
});

// POST /api/auth/accept-invitation - Accept employee invitation
router.post('/accept-invitation', async (req, res) => {
  const client = await db.getClient();
  try {
    const { token, password, firstName, lastName } = req.body;

    // Validation
    if (!token || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invitation token and password are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 8 characters',
      });
    }

    // Begin transaction FIRST to enable row locking
    await client.query('BEGIN');

    // SECURITY: Use SELECT FOR UPDATE to prevent race condition where two
    // concurrent requests could both accept the same invitation.
    // This locks the invitation row until the transaction completes.
    const inviteResult = await client.query(
      `SELECT i.*, o.name as organization_name, o.slug as organization_slug
       FROM employee_invitations i
       JOIN organizations o ON i.organization_id = o.id
       WHERE i.token = $1 AND i.status = 'pending' AND i.expires_at > NOW()
       FOR UPDATE OF i`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Invalid Invitation',
        message: 'This invitation is invalid, expired, or has already been used',
      });
    }

    const invitation = inviteResult.rows[0];

    // Check if user already exists with this email
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [invitation.email]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Validation Error',
        message: 'An account with this email already exists. Please log in instead.',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, organization_id, is_demo_account)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id, email, role, organization_id`,
      [invitation.email, passwordHash, invitation.role, invitation.organization_id]
    );

    const user = userResult.rows[0];

    // Create employee record
    const empResult = await client.query(
      `INSERT INTO employees (
        user_id, first_name, last_name, email, job_title, hire_date,
        organization_id, department_id, reports_to_id, employment_status, onboarding_completed
      )
       VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, $7, $8, 'active', false)
       RETURNING id`,
      [
        user.id,
        firstName || invitation.first_name || 'New',
        lastName || invitation.last_name || 'Employee',
        invitation.email,
        invitation.job_title || 'Employee',
        invitation.organization_id,
        invitation.department_id,
        invitation.reports_to_id,
      ]
    );

    const employeeId = empResult.rows[0].id;

    // Create default baselines
    await client.query(
      `INSERT INTO employee_baselines (employee_id, baseline_sleep_hours, baseline_sleep_quality, baseline_hrv, baseline_resting_hr, baseline_hours_worked)
       VALUES ($1, 7, 70, 45, 65, 8)`,
      [employeeId]
    );

    // Update invitation status
    await client.query(
      `UPDATE employee_invitations
       SET status = 'accepted', accepted_at = NOW(), employee_id = $1
       WHERE id = $2`,
      [employeeId, invitation.id]
    );

    // Commit transaction
    await client.query('COMMIT');

    // Generate token
    const jwtToken = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId,
      organizationId: invitation.organization_id,
      organizationSlug: invitation.organization_slug,
      isDemoAccount: false,
    });

    res.status(201).json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: invitation.organization_id,
        organizationSlug: invitation.organization_slug,
        organizationName: invitation.organization_name,
        isDemoAccount: false,
      },
      employeeId,
      message: 'Account created successfully. Welcome to the team!',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Accept invitation error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to accept invitation' });
  } finally {
    client.release();
  }
});

// GET /api/auth/invitation/:token - Get invitation details (for display on accept page)
router.get('/invitation/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const result = await db.query(
      `SELECT i.email, i.first_name, i.last_name, i.role, i.job_title, i.expires_at, i.status,
              o.name as organization_name, o.logo_url as organization_logo,
              d.name as department_name
       FROM employee_invitations i
       JOIN organizations o ON i.organization_id = o.id
       LEFT JOIN departments d ON i.department_id = d.id
       WHERE i.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Invitation not found',
      });
    }

    const invitation = result.rows[0];

    // Check if expired or already used
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        error: 'Invalid Invitation',
        message: invitation.status === 'accepted'
          ? 'This invitation has already been accepted'
          : 'This invitation is no longer valid',
        status: invitation.status,
      });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({
        error: 'Expired Invitation',
        message: 'This invitation has expired. Please request a new one.',
        status: 'expired',
      });
    }

    res.json({
      email: invitation.email,
      firstName: invitation.first_name,
      lastName: invitation.last_name,
      role: invitation.role,
      jobTitle: invitation.job_title,
      organizationName: invitation.organization_name,
      organizationLogo: invitation.organization_logo,
      departmentName: invitation.department_name,
      expiresAt: invitation.expires_at,
    });
  } catch (err) {
    console.error('Get invitation error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get invitation details' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  // JWT tokens are stateless - client should discard the token
  // In a production app, you might want to implement token blacklisting
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/refresh
router.post('/refresh', authenticate, async (req, res) => {
  try {
    // Get fresh organization info
    const userResult = await db.query(
      `SELECT u.organization_id, u.is_demo_account, o.slug as organization_slug
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1`,
      [req.user.userId]
    );

    const userData = userResult.rows[0] || {};

    // Generate new token with same user info
    const token = generateToken({
      id: req.user.userId,
      email: req.user.email,
      role: req.user.role,
      employeeId: req.user.employeeId,
      organizationId: userData.organization_id || req.user.organizationId,
      organizationSlug: userData.organization_slug || req.user.organizationSlug,
      isDemoAccount: userData.is_demo_account || req.user.isDemoAccount,
    });

    res.json({ token });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Token refresh failed' });
  }
});

// DELETE /api/auth/account - Delete user account
router.delete('/account', authenticate, async (req, res) => {
  const client = await db.getClient();
  try {
    const { password } = req.body;
    const userId = req.user.userId;

    // Verify password before deletion
    const userResult = await client.query(
      'SELECT password_hash, role, organization_id FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    const user = userResult.rows[0];

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      client.release();
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid password' });
    }

    // Super admins cannot delete their account if they're the only admin
    if (user.role === 'super_admin') {
      const adminCount = await client.query(
        `SELECT COUNT(*) FROM users WHERE organization_id = $1 AND role IN ('super_admin', 'admin')`,
        [user.organization_id]
      );

      if (parseInt(adminCount.rows[0].count) <= 1) {
        client.release();
        return res.status(400).json({
          error: 'Cannot Delete',
          message: 'Cannot delete the only admin account. Please assign another admin first.',
        });
      }
    }

    // Get employee ID for cascade deletion
    const employeeId = req.user.employeeId;

    // Begin transaction for all delete operations
    await client.query('BEGIN');

    // Delete in order to respect foreign key constraints
    if (employeeId) {
      // Delete all employee-related data
      await client.query('DELETE FROM wellness_streaks WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM email_metrics WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM detected_patterns WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM predictive_alerts WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM privacy_settings WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM zone_history WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM work_metrics WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM health_metrics WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM employee_baselines WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM feeling_checkins WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM personal_preferences WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM life_events WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM alerts WHERE employee_id = $1', [employeeId]);
      await client.query('DELETE FROM challenge_participants WHERE employee_id = $1', [employeeId]);

      // Remove from any team (set manager_id and reports_to_id to null for reports)
      await client.query('UPDATE employees SET manager_id = NULL WHERE manager_id = $1', [employeeId]);
      await client.query('UPDATE employees SET reports_to_id = NULL WHERE reports_to_id = $1', [employeeId]);

      // Remove as department manager
      await client.query('UPDATE departments SET manager_employee_id = NULL WHERE manager_employee_id = $1', [employeeId]);

      // Delete employee record
      await client.query('DELETE FROM employees WHERE id = $1', [employeeId]);
    }

    // Delete user-related data
    await client.query('DELETE FROM reminder_settings WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM notification_preferences WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM google_calendar_tokens WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM gmail_tokens WHERE user_id = $1', [userId]);

    // Finally delete the user
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    // Commit all changes
    await client.query('COMMIT');

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    // Rollback on any error
    await client.query('ROLLBACK');
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to delete account' });
  } finally {
    client.release();
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    const userResult = await db.query(
      `SELECT u.id, u.email, u.role, u.profile_picture_url, u.organization_id, u.is_demo_account,
              o.name as organization_name, o.slug as organization_slug, o.logo_url as organization_logo,
              o.subscription_tier, o.subscription_status
       FROM users u
       LEFT JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1`,
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get employee details if applicable
    let employee = null;
    if (req.user.employeeId) {
      const empResult = await db.query(
        `SELECT e.id, e.first_name, e.last_name, e.email, e.department, e.job_title,
                e.department_id, e.employment_status, e.onboarding_completed,
                d.name as department_name
         FROM employees e
         LEFT JOIN departments d ON e.department_id = d.id
         WHERE e.id = $1`,
        [req.user.employeeId]
      );
      if (empResult.rows.length > 0) {
        const emp = empResult.rows[0];
        employee = {
          id: emp.id,
          firstName: emp.first_name,
          lastName: emp.last_name,
          email: emp.email,
          department: emp.department,
          departmentId: emp.department_id,
          departmentName: emp.department_name,
          jobTitle: emp.job_title,
          employmentStatus: emp.employment_status,
          onboardingCompleted: emp.onboarding_completed,
        };
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      profilePictureUrl: user.profile_picture_url,
      organizationId: user.organization_id,
      organizationName: user.organization_name,
      organizationSlug: user.organization_slug,
      organizationLogo: user.organization_logo,
      subscriptionTier: user.subscription_tier,
      subscriptionStatus: user.subscription_status,
      isDemoAccount: user.is_demo_account,
      employee,
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get user info' });
  }
});

module.exports = router;
