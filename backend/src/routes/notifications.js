const express = require('express');
const db = require('../utils/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { sendSMS } = require('../services/smsService');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/notifications/sms/config - Get SMS preferences
router.get('/sms/config', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sms_enabled, sms_phone_number, sms_on_burnout, sms_on_opportunity
      FROM notification_preferences
      WHERE user_id = $1
    `, [req.user.userId]);

    if (result.rows.length === 0) {
      // Return defaults if no preferences set
      return res.json({
        smsEnabled: false,
        phoneNumber: null,
        onBurnout: true,
        onOpportunity: true,
      });
    }

    const row = result.rows[0];
    res.json({
      smsEnabled: row.sms_enabled,
      phoneNumber: row.sms_phone_number,
      onBurnout: row.sms_on_burnout,
      onOpportunity: row.sms_on_opportunity,
    });
  } catch (err) {
    console.error('Get SMS config error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get SMS configuration' });
  }
});

// POST /api/notifications/sms/config - Update SMS preferences
router.post('/sms/config', async (req, res) => {
  try {
    const { smsEnabled, phoneNumber, onBurnout, onOpportunity } = req.body;

    // Upsert notification preferences
    await db.query(`
      INSERT INTO notification_preferences (user_id, sms_enabled, sms_phone_number, sms_on_burnout, sms_on_opportunity)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        sms_enabled = COALESCE($2, notification_preferences.sms_enabled),
        sms_phone_number = COALESCE($3, notification_preferences.sms_phone_number),
        sms_on_burnout = COALESCE($4, notification_preferences.sms_on_burnout),
        sms_on_opportunity = COALESCE($5, notification_preferences.sms_on_opportunity),
        updated_at = NOW()
    `, [
      req.user.userId,
      smsEnabled !== undefined ? smsEnabled : true,
      phoneNumber || null,
      onBurnout !== undefined ? onBurnout : true,
      onOpportunity !== undefined ? onOpportunity : true,
    ]);

    // Return updated config
    const result = await db.query(`
      SELECT sms_enabled, sms_phone_number, sms_on_burnout, sms_on_opportunity
      FROM notification_preferences
      WHERE user_id = $1
    `, [req.user.userId]);

    const row = result.rows[0];
    res.json({
      smsEnabled: row.sms_enabled,
      phoneNumber: row.sms_phone_number,
      onBurnout: row.sms_on_burnout,
      onOpportunity: row.sms_on_opportunity,
    });
  } catch (err) {
    console.error('Update SMS config error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update SMS configuration' });
  }
});

// GET /api/notifications/sms/logs - Get SMS history
router.get('/sms/logs', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    let query = `
      SELECT
        sl.id,
        sl.phone_number,
        sl.recipient_type,
        sl.message_body,
        sl.status,
        sl.error_message,
        sl.sent_at,
        a.title AS alert_title
      FROM sms_logs sl
      LEFT JOIN alerts a ON sl.alert_id = a.id
    `;

    // Employees can only see their own SMS logs (through associated alerts)
    if (req.user.role === 'employee' && req.user.employeeId) {
      query += ` WHERE sl.recipient_user_id = $1 OR a.employee_id = $2`;
      query += ` ORDER BY sl.sent_at DESC LIMIT $3`;
      const result = await db.query(query, [req.user.userId, req.user.employeeId, parseInt(limit)]);
      return res.json(formatSmsLogs(result.rows));
    }

    query += ` ORDER BY sl.sent_at DESC LIMIT $1`;
    const result = await db.query(query, [parseInt(limit)]);
    res.json(formatSmsLogs(result.rows));
  } catch (err) {
    console.error('Get SMS logs error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get SMS logs' });
  }
});

function formatSmsLogs(rows) {
  return rows.map(row => ({
    id: row.id,
    phoneNumber: row.phone_number,
    recipientType: row.recipient_type,
    messageBody: row.message_body,
    status: row.status,
    errorMessage: row.error_message,
    sentAt: row.sent_at,
    alertTitle: row.alert_title,
  }));
}

// GET /api/notifications/sms/status - Check Twilio configuration status
router.get('/sms/status', requireRole('manager'), async (req, res) => {
  const isConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );

  res.json({
    configured: isConfigured,
    twilioNumber: isConfigured ? process.env.TWILIO_PHONE_NUMBER.slice(-4) : null,
  });
});

// POST /api/notifications/sms/test - Send a test SMS
router.post('/sms/test', requireRole('manager'), async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Phone number is required',
      });
    }

    // Check if Twilio is configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
      return res.status(400).json({
        error: 'Configuration Error',
        message: 'Twilio is not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your environment.',
      });
    }

    const testMessage = `[ShepHerd] This is a test message. Your SMS notifications are working correctly!`;
    const result = await sendSMS(phoneNumber, testMessage);

    if (result.success) {
      res.json({
        success: true,
        message: 'Test SMS sent successfully',
        sid: result.sid,
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'SMS Failed',
        message: result.error,
      });
    }
  } catch (err) {
    console.error('Test SMS error:', err);
    res.status(500).json({
      error: 'Server Error',
      message: 'Failed to send test SMS',
    });
  }
});

module.exports = router;
