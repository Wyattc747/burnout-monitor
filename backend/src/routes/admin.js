const express = require('express');
const crypto = require('crypto');
const db = require('../utils/db');
const { authenticate, requireAdmin, requirePermission, canManageUser, ROLES } = require('../middleware/auth');
const { requireOrganization, checkEmployeeLimit, logAuditAction } = require('../middleware/tenant');
const { sendInvitationEmail, sendBulkInvitationEmails } = require('../services/emailService');

const router = express.Router();

// All routes require authentication, organization, and admin privileges
router.use(authenticate);
router.use(requireOrganization);
router.use(requireAdmin);

// Helper to generate secure invitation token
function generateInviteToken() {
  return crypto.randomBytes(32).toString('hex');
}

// GET /api/admin/employees - List all organization employees
router.get('/employees', async (req, res) => {
  try {
    const {
      status = 'all',
      departmentId,
      search,
      role,
      limit = 50,
      offset = 0,
      sortBy = 'lastName',
      sortOrder = 'asc',
    } = req.query;

    let query = `
      SELECT e.id, e.first_name, e.last_name, e.email, e.phone,
             e.job_title, e.department, e.department_id, e.hire_date,
             e.employment_status, e.hierarchy_level, e.reports_to_id, e.manager_id,
             e.hr_external_id, e.onboarding_completed, e.created_at,
             d.name as department_name,
             u.id as user_id, u.email as user_email, u.role,
             m.first_name as manager_first_name, m.last_name as manager_last_name
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN employees m ON e.manager_id = m.id
      WHERE e.organization_id = $1
    `;

    const params = [req.user.organizationId];
    let paramIndex = 2;

    // Filters
    if (status !== 'all') {
      query += ` AND e.employment_status = $${paramIndex++}`;
      params.push(status);
    }

    if (departmentId) {
      query += ` AND e.department_id = $${paramIndex++}`;
      params.push(departmentId);
    }

    if (search) {
      query += ` AND (
        e.first_name ILIKE $${paramIndex} OR
        e.last_name ILIKE $${paramIndex} OR
        e.email ILIKE $${paramIndex} OR
        e.job_title ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      query += ` AND u.role = $${paramIndex++}`;
      params.push(role);
    }

    // Count total before pagination
    const countQuery = query.replace(
      /SELECT .* FROM/,
      'SELECT COUNT(*) FROM'
    );
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Sorting
    const validSortColumns = {
      firstName: 'e.first_name',
      lastName: 'e.last_name',
      email: 'e.email',
      department: 'd.name',
      status: 'e.employment_status',
      hireDate: 'e.hire_date',
      role: 'u.role',
    };

    const sortColumn = validSortColumns[sortBy] || 'e.last_name';
    const order = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    query += ` ORDER BY ${sortColumn} ${order}`;

    // Pagination
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(Math.min(parseInt(limit), 100), parseInt(offset));

    const result = await db.query(query, params);

    res.json({
      employees: result.rows.map(row => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        jobTitle: row.job_title,
        department: row.department,
        departmentId: row.department_id,
        departmentName: row.department_name,
        hireDate: row.hire_date,
        employmentStatus: row.employment_status,
        hierarchyLevel: row.hierarchy_level,
        reportsToId: row.reports_to_id,
        managerId: row.manager_id,
        managerName: row.manager_first_name
          ? `${row.manager_first_name} ${row.manager_last_name}`
          : null,
        hrExternalId: row.hr_external_id,
        onboardingCompleted: row.onboarding_completed,
        userId: row.user_id,
        userEmail: row.user_email,
        role: row.role,
        createdAt: row.created_at,
      })),
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('Get employees error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get employees' });
  }
});

// POST /api/admin/employees/invite - Send employee invitation(s)
router.post('/employees/invite', requirePermission('users:invite'), checkEmployeeLimit, async (req, res) => {
  const client = await db.getClient();
  try {
    const { invitations } = req.body;

    if (!invitations || !Array.isArray(invitations) || invitations.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'At least one invitation is required',
      });
    }

    // Check if we have capacity for all invitations
    if (invitations.length > req.employeeLimits.remaining) {
      return res.status(403).json({
        error: 'Limit Exceeded',
        message: `Can only invite ${req.employeeLimits.remaining} more employees. Upgrade your plan for more.`,
        requested: invitations.length,
        remaining: req.employeeLimits.remaining,
      });
    }

    const batchId = crypto.randomUUID();
    const results = [];
    const errors = [];

    await client.query('BEGIN');

    for (const inv of invitations) {
      try {
        const { email, firstName, lastName, role = 'employee', departmentId, jobTitle, reportsToId } = inv;

        if (!email) {
          errors.push({ email, error: 'Email is required' });
          continue;
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check for valid role
        if (!['admin', 'manager', 'employee'].includes(role)) {
          errors.push({ email: normalizedEmail, error: 'Invalid role' });
          continue;
        }

        // Check if user already exists
        const existingUser = await client.query(
          'SELECT id FROM users WHERE email = $1',
          [normalizedEmail]
        );

        if (existingUser.rows.length > 0) {
          errors.push({ email: normalizedEmail, error: 'User already exists' });
          continue;
        }

        // Check if pending invitation exists
        const existingInvite = await client.query(
          `SELECT id FROM employee_invitations
           WHERE email = $1 AND organization_id = $2 AND status = 'pending'`,
          [normalizedEmail, req.user.organizationId]
        );

        if (existingInvite.rows.length > 0) {
          errors.push({ email: normalizedEmail, error: 'Pending invitation already exists' });
          continue;
        }

        // Generate token and expiration (7 days)
        const token = generateInviteToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        // Create invitation
        const result = await client.query(
          `INSERT INTO employee_invitations
            (organization_id, email, first_name, last_name, role, department_id, job_title, reports_to_id, token, expires_at, invited_by, batch_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           RETURNING id, email, token, expires_at`,
          [
            req.user.organizationId,
            normalizedEmail,
            firstName || null,
            lastName || null,
            role,
            departmentId || null,
            jobTitle || null,
            reportsToId || null,
            token,
            expiresAt,
            req.user.userId,
            batchId,
          ]
        );

        results.push({
          id: result.rows[0].id,
          email: result.rows[0].email,
          token: result.rows[0].token,
          expiresAt: result.rows[0].expires_at,
          inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${result.rows[0].token}`,
        });
      } catch (invErr) {
        errors.push({ email: inv.email, error: invErr.message });
      }
    }

    await client.query('COMMIT');

    // Log audit action
    await logAuditAction(
      req,
      'employees.invited',
      'invitation',
      batchId,
      null,
      { count: results.length, emails: results.map(r => r.email) }
    );

    // Get organization name for emails
    const orgResult = await db.query(
      'SELECT name FROM organizations WHERE id = $1',
      [req.user.organizationId]
    );
    const organizationName = orgResult.rows[0]?.name || 'Your Organization';

    // Get inviter's name
    const inviterResult = await db.query(
      'SELECT first_name, last_name FROM employees WHERE user_id = $1',
      [req.user.userId]
    );
    const inviterName = inviterResult.rows[0]
      ? `${inviterResult.rows[0].first_name} ${inviterResult.rows[0].last_name}`
      : null;

    // Send invitation emails (async, don't block response)
    const emailPromises = results.map(async (inv) => {
      const originalInvitation = invitations.find(i => i.email?.toLowerCase() === inv.email);
      // Get department name if departmentId was provided
      let departmentName = null;
      if (originalInvitation?.departmentId) {
        const deptResult = await db.query('SELECT name FROM departments WHERE id = $1', [originalInvitation.departmentId]);
        departmentName = deptResult.rows[0]?.name;
      }
      return sendInvitationEmail({
        email: inv.email,
        firstName: originalInvitation?.firstName,
        lastName: originalInvitation?.lastName,
        role: originalInvitation?.role || 'employee',
        jobTitle: originalInvitation?.jobTitle,
        departmentName,
        token: inv.token,
        expiresAt: inv.expiresAt,
        invitedByName: inviterName,
      }, organizationName);
    });

    // Wait for all emails to be sent
    const emailResults = await Promise.all(emailPromises);
    const emailsSent = emailResults.filter(r => r.success).length;
    const emailsFailed = emailResults.filter(r => !r.success).length;

    res.status(201).json({
      sent: results.length,
      failed: errors.length,
      emailsSent,
      emailsFailed,
      invitations: results,
      errors: errors.length > 0 ? errors : undefined,
      batchId,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Send invitations error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to send invitations' });
  } finally {
    client.release();
  }
});

// POST /api/admin/employees/import - CSV bulk import
router.post('/employees/import', requirePermission('users:create'), checkEmployeeLimit, async (req, res) => {
  const client = await db.getClient();
  try {
    const { employees, sendInvitations = true } = req.body;

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Employee data array is required',
      });
    }

    // Check capacity
    if (employees.length > req.employeeLimits.remaining) {
      return res.status(403).json({
        error: 'Limit Exceeded',
        message: `Can only add ${req.employeeLimits.remaining} more employees. Upgrade your plan for more.`,
        requested: employees.length,
        remaining: req.employeeLimits.remaining,
      });
    }

    const batchId = crypto.randomUUID();
    const created = [];
    const invited = [];
    const errors = [];

    await client.query('BEGIN');

    for (const emp of employees) {
      try {
        const {
          email,
          firstName,
          lastName,
          department,
          departmentId,
          jobTitle,
          role = 'employee',
          reportsToEmail,
          hireDate,
        } = emp;

        if (!email || !firstName || !lastName) {
          errors.push({ email, error: 'Email, firstName, and lastName are required' });
          continue;
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user/employee already exists
        const existingCheck = await client.query(
          `SELECT u.id as user_id, e.id as employee_id
           FROM users u
           LEFT JOIN employees e ON e.user_id = u.id
           WHERE u.email = $1`,
          [normalizedEmail]
        );

        if (existingCheck.rows.length > 0) {
          errors.push({ email: normalizedEmail, error: 'User already exists' });
          continue;
        }

        // Resolve department ID from name if needed
        let deptId = departmentId;
        if (!deptId && department) {
          const deptResult = await client.query(
            'SELECT id FROM departments WHERE organization_id = $1 AND name ILIKE $2',
            [req.user.organizationId, department]
          );
          if (deptResult.rows.length > 0) {
            deptId = deptResult.rows[0].id;
          }
        }

        // Resolve reports_to from email if provided
        let reportsToId = null;
        if (reportsToEmail) {
          const managerResult = await client.query(
            `SELECT e.id FROM employees e
             JOIN users u ON e.user_id = u.id
             WHERE u.email = $1 AND e.organization_id = $2`,
            [reportsToEmail.toLowerCase(), req.user.organizationId]
          );
          if (managerResult.rows.length > 0) {
            reportsToId = managerResult.rows[0].id;
          }
        }

        // Create employee record (without user account yet)
        const empResult = await client.query(
          `INSERT INTO employees
            (organization_id, first_name, last_name, email, department, department_id, job_title, reports_to_id, hire_date, employment_status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
           RETURNING id`,
          [
            req.user.organizationId,
            firstName.trim(),
            lastName.trim(),
            normalizedEmail,
            department || null,
            deptId || null,
            jobTitle || null,
            reportsToId,
            hireDate || null,
          ]
        );

        const employeeId = empResult.rows[0].id;
        created.push({ id: employeeId, email: normalizedEmail });

        // Create invitation if requested
        if (sendInvitations) {
          const token = generateInviteToken();
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          const invResult = await client.query(
            `INSERT INTO employee_invitations
              (organization_id, email, first_name, last_name, role, department_id, job_title, reports_to_id, token, expires_at, invited_by, batch_id, employee_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING id, token`,
            [
              req.user.organizationId,
              normalizedEmail,
              firstName,
              lastName,
              role,
              deptId,
              jobTitle,
              reportsToId,
              token,
              expiresAt,
              req.user.userId,
              batchId,
              employeeId,
            ]
          );

          invited.push({
            employeeId,
            email: normalizedEmail,
            inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${invResult.rows[0].token}`,
          });
        }
      } catch (empErr) {
        errors.push({ email: emp.email, error: empErr.message });
      }
    }

    await client.query('COMMIT');

    // Log audit action
    await logAuditAction(
      req,
      'employees.bulk_imported',
      'employee',
      batchId,
      null,
      { created: created.length, invited: invited.length }
    );

    res.status(201).json({
      created: created.length,
      invited: invited.length,
      failed: errors.length,
      employees: created,
      invitations: sendInvitations ? invited : undefined,
      errors: errors.length > 0 ? errors : undefined,
      batchId,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to import employees' });
  } finally {
    client.release();
  }
});

// PUT /api/admin/employees/:id/role - Change user role
router.put('/employees/:id/role', requirePermission('users:change_role'), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'manager', 'employee'].includes(role)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Valid role is required (admin, manager, or employee)',
      });
    }

    // Get employee and current user info
    const empResult = await db.query(
      `SELECT e.id, e.user_id, u.role as current_role
       FROM employees e
       LEFT JOIN users u ON e.user_id = u.id
       WHERE e.id = $1 AND e.organization_id = $2`,
      [id, req.user.organizationId]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Employee not found' });
    }

    const emp = empResult.rows[0];

    if (!emp.user_id) {
      return res.status(400).json({
        error: 'Cannot Change Role',
        message: 'Employee does not have a user account yet',
      });
    }

    // Check role hierarchy - can't promote to same or higher level
    if (!canManageUser(req.user.role, role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You cannot assign this role level',
      });
    }

    // Prevent demoting the last admin
    if (emp.current_role === 'admin' || emp.current_role === 'super_admin') {
      const adminCount = await db.query(
        `SELECT COUNT(*) FROM users WHERE organization_id = $1 AND role IN ('super_admin', 'admin')`,
        [req.user.organizationId]
      );

      if (parseInt(adminCount.rows[0].count) <= 1 && role !== 'admin') {
        return res.status(400).json({
          error: 'Cannot Change Role',
          message: 'Cannot demote the only admin. Assign another admin first.',
        });
      }
    }

    // Update role
    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, emp.user_id]);

    // Log audit action
    await logAuditAction(
      req,
      'user.role_changed',
      'user',
      emp.user_id,
      { role: emp.current_role },
      { role }
    );

    res.json({
      employeeId: id,
      userId: emp.user_id,
      previousRole: emp.current_role,
      newRole: role,
    });
  } catch (err) {
    console.error('Change role error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to change role' });
  }
});

// PUT /api/admin/employees/:id/status - Change employment status
router.put('/employees/:id/status', requirePermission('users:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'active', 'on_leave', 'terminated'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Valid status is required (${validStatuses.join(', ')})`,
      });
    }

    // Get employee
    const empResult = await db.query(
      'SELECT id, employment_status FROM employees WHERE id = $1 AND organization_id = $2',
      [id, req.user.organizationId]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Employee not found' });
    }

    const previousStatus = empResult.rows[0].employment_status;

    // Update status
    await db.query(
      'UPDATE employees SET employment_status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );

    // Log audit action
    await logAuditAction(
      req,
      'employee.status_changed',
      'employee',
      id,
      { employmentStatus: previousStatus },
      { employmentStatus: status }
    );

    res.json({
      employeeId: id,
      previousStatus,
      newStatus: status,
    });
  } catch (err) {
    console.error('Change status error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to change status' });
  }
});

// PUT /api/admin/employees/:id/manager - Assign manager
router.put('/employees/:id/manager', requirePermission('users:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { managerId } = req.body;

    // Get employee
    const empResult = await db.query(
      'SELECT id, manager_id, reports_to_id, first_name, last_name FROM employees WHERE id = $1 AND organization_id = $2',
      [id, req.user.organizationId]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Employee not found' });
    }

    const employee = empResult.rows[0];
    const previousManagerId = employee.manager_id;

    // If managerId is provided, verify manager exists and is in same org
    if (managerId) {
      const managerResult = await db.query(
        `SELECT e.id, e.first_name, e.last_name, u.role
         FROM employees e
         JOIN users u ON e.user_id = u.id
         WHERE e.id = $1 AND e.organization_id = $2`,
        [managerId, req.user.organizationId]
      );

      if (managerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Not Found', message: 'Manager not found' });
      }

      // Prevent assigning employee to themselves
      if (managerId === id) {
        return res.status(400).json({ error: 'Validation Error', message: 'Cannot assign employee as their own manager' });
      }
    }

    // Update manager
    await db.query(
      'UPDATE employees SET manager_id = $1, reports_to_id = $1, updated_at = NOW() WHERE id = $2',
      [managerId || null, id]
    );

    // Log audit action
    await logAuditAction(
      req,
      'employee.manager_changed',
      'employee',
      id,
      { managerId: previousManagerId },
      { managerId: managerId || null }
    );

    res.json({
      employeeId: id,
      previousManagerId,
      newManagerId: managerId || null,
    });
  } catch (err) {
    console.error('Assign manager error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to assign manager' });
  }
});

// GET /api/admin/invitations - List all invitations
router.get('/invitations', async (req, res) => {
  try {
    const { status = 'all', limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT i.*, d.name as department_name,
             inv.first_name as invited_by_first_name, inv.last_name as invited_by_last_name
      FROM employee_invitations i
      LEFT JOIN departments d ON i.department_id = d.id
      LEFT JOIN users u ON i.invited_by = u.id
      LEFT JOIN employees inv ON u.id = inv.user_id
      WHERE i.organization_id = $1
    `;

    const params = [req.user.organizationId];
    let paramIndex = 2;

    if (status !== 'all') {
      query += ` AND i.status = $${paramIndex++}`;
      params.push(status);
    }

    query += ' ORDER BY i.created_at DESC';

    // Count total
    const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await db.query(countQuery.split('ORDER BY')[0], params);

    // Pagination
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(Math.min(parseInt(limit), 100), parseInt(offset));

    const result = await db.query(query, params);

    res.json({
      invitations: result.rows.map(row => ({
        id: row.id,
        email: row.email,
        firstName: row.first_name,
        lastName: row.last_name,
        role: row.role,
        departmentId: row.department_id,
        departmentName: row.department_name,
        jobTitle: row.job_title,
        status: row.status,
        expiresAt: row.expires_at,
        invitedBy: row.invited_by_first_name
          ? `${row.invited_by_first_name} ${row.invited_by_last_name}`
          : null,
        createdAt: row.created_at,
        acceptedAt: row.accepted_at,
      })),
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('Get invitations error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get invitations' });
  }
});

// DELETE /api/admin/invitations/:id - Revoke invitation
router.delete('/invitations/:id', requirePermission('users:invite'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE employee_invitations SET status = 'revoked'
       WHERE id = $1 AND organization_id = $2 AND status = 'pending'
       RETURNING id, email`,
      [id, req.user.organizationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Invitation not found or already processed' });
    }

    // Log audit action
    await logAuditAction(req, 'invitation.revoked', 'invitation', id, null, { email: result.rows[0].email });

    res.json({ message: 'Invitation revoked successfully', id, email: result.rows[0].email });
  } catch (err) {
    console.error('Revoke invitation error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to revoke invitation' });
  }
});

// POST /api/admin/invitations/:id/resend - Resend invitation
router.post('/invitations/:id/resend', requirePermission('users:invite'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get current invitation
    const invResult = await db.query(
      `SELECT * FROM employee_invitations WHERE id = $1 AND organization_id = $2`,
      [id, req.user.organizationId]
    );

    if (invResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Invitation not found' });
    }

    const inv = invResult.rows[0];

    if (inv.status !== 'pending' && inv.status !== 'expired') {
      return res.status(400).json({ error: 'Cannot Resend', message: 'Invitation has already been used' });
    }

    // Generate new token and expiration
    const token = generateInviteToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await db.query(
      `UPDATE employee_invitations SET token = $1, expires_at = $2, status = 'pending'
       WHERE id = $3`,
      [token, expiresAt, id]
    );

    // Get organization name and department name for email
    const orgResult = await db.query(
      'SELECT name FROM organizations WHERE id = $1',
      [req.user.organizationId]
    );
    const organizationName = orgResult.rows[0]?.name || 'Your Organization';

    let departmentName = null;
    if (inv.department_id) {
      const deptResult = await db.query('SELECT name FROM departments WHERE id = $1', [inv.department_id]);
      departmentName = deptResult.rows[0]?.name;
    }

    // Get inviter's name
    const inviterResult = await db.query(
      'SELECT first_name, last_name FROM employees WHERE user_id = $1',
      [req.user.userId]
    );
    const inviterName = inviterResult.rows[0]
      ? `${inviterResult.rows[0].first_name} ${inviterResult.rows[0].last_name}`
      : null;

    // Send invitation email
    const emailResult = await sendInvitationEmail({
      email: inv.email,
      firstName: inv.first_name,
      lastName: inv.last_name,
      role: inv.role,
      jobTitle: inv.job_title,
      departmentName,
      token,
      expiresAt,
      invitedByName: inviterName,
    }, organizationName);

    res.json({
      id,
      email: inv.email,
      token,
      expiresAt,
      inviteUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${token}`,
      emailSent: emailResult.success,
    });
  } catch (err) {
    console.error('Resend invitation error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to resend invitation' });
  }
});

// GET /api/admin/audit-log - Get audit log
router.get('/audit-log', requirePermission('audit:read'), async (req, res) => {
  try {
    const { action, resourceType, userId, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT id, user_id, user_email, action, resource_type, resource_id,
             old_values, new_values, ip_address, created_at
      FROM organization_audit_logs
      WHERE organization_id = $1
    `;

    const params = [req.user.organizationId];
    let paramIndex = 2;

    if (action) {
      query += ` AND action = $${paramIndex++}`;
      params.push(action);
    }

    if (resourceType) {
      query += ` AND resource_type = $${paramIndex++}`;
      params.push(resourceType);
    }

    if (userId) {
      query += ` AND user_id = $${paramIndex++}`;
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    // Count total
    const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await db.query(countQuery.split('ORDER BY')[0], params);

    // Pagination
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(Math.min(parseInt(limit), 100), parseInt(offset));

    const result = await db.query(query, params);

    res.json({
      entries: result.rows.map(row => ({
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
    console.error('Get audit log error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get audit log' });
  }
});

module.exports = router;
