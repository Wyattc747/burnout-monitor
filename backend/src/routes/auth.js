const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../utils/db');
const { authenticate, generateToken } = require('../middleware/auth');
const { validate, loginSchema, registerSchema } = require('../middleware/validate');

const router = express.Router();

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const userResult = await db.query(
      'SELECT id, email, password_hash, role FROM users WHERE email = $1',
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

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      employeeId,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Login failed' });
  }
});

// POST /api/auth/register
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

    // Create user (employees by default)
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, $2, 'employee')
       RETURNING id, email, role`,
      [email.toLowerCase(), passwordHash]
    );

    const user = userResult.rows[0];

    // Create employee record
    const empResult = await client.query(
      `INSERT INTO employees (user_id, first_name, last_name, email, department, job_title, hire_date)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE)
       RETURNING id`,
      [user.id, firstName, lastName, email.toLowerCase(), department || 'General', jobTitle || 'Employee']
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
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
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

// POST /api/auth/logout
router.post('/logout', authenticate, (req, res) => {
  // JWT tokens are stateless - client should discard the token
  // In a production app, you might want to implement token blacklisting
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/refresh
router.post('/refresh', authenticate, async (req, res) => {
  try {
    // Generate new token with same user info
    const token = generateToken({
      id: req.user.userId,
      email: req.user.email,
      role: req.user.role,
      employeeId: req.user.employeeId,
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
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    const validPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!validPassword) {
      client.release();
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid password' });
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

      // Remove from any team (set manager_id to null for reports)
      await client.query('UPDATE employees SET manager_id = NULL WHERE manager_id = $1', [employeeId]);

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
      'SELECT id, email, role, profile_picture_url FROM users WHERE id = $1',
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
        'SELECT id, first_name, last_name, email, department, job_title FROM employees WHERE id = $1',
        [req.user.employeeId]
      );
      if (empResult.rows.length > 0) {
        employee = {
          id: empResult.rows[0].id,
          firstName: empResult.rows[0].first_name,
          lastName: empResult.rows[0].last_name,
          email: empResult.rows[0].email,
          department: empResult.rows[0].department,
          jobTitle: empResult.rows[0].job_title,
        };
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      profilePictureUrl: user.profile_picture_url,
      employee,
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get user info' });
  }
});

module.exports = router;
