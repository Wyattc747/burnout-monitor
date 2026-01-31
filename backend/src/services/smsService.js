const db = require('../utils/db');

let twilioClient = null;

function getTwilioClient() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

async function sendSMS(phoneNumber, message, alertId = null, recipientUserId = null) {
  const client = getTwilioClient();

  if (!client) {
    console.warn('Twilio not configured - SMS not sent');
    // Log the attempt even if Twilio isn't configured (for demo purposes)
    await logSMS({
      alertId,
      phoneNumber,
      recipientType: recipientUserId ? 'manager' : 'employee',
      recipientUserId,
      messageBody: message,
      twilioSid: null,
      status: 'skipped',
      errorMessage: 'Twilio not configured',
    });
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    await logSMS({
      alertId,
      phoneNumber,
      recipientType: recipientUserId ? 'manager' : 'employee',
      recipientUserId,
      messageBody: message,
      twilioSid: result.sid,
      status: 'sent',
      errorMessage: null,
    });

    // Mark alert as SMS sent
    if (alertId) {
      await db.query(`
        UPDATE alerts SET sms_sent = true, sms_sent_at = NOW()
        WHERE id = $1
      `, [alertId]);
    }

    return { success: true, sid: result.sid };
  } catch (err) {
    console.error('SMS send error:', err);

    await logSMS({
      alertId,
      phoneNumber,
      recipientType: recipientUserId ? 'manager' : 'employee',
      recipientUserId,
      messageBody: message,
      twilioSid: null,
      status: 'failed',
      errorMessage: err.message,
    });

    return { success: false, error: err.message };
  }
}

async function logSMS({ alertId, phoneNumber, recipientType, recipientUserId, messageBody, twilioSid, status, errorMessage }) {
  try {
    await db.query(`
      INSERT INTO sms_logs (alert_id, phone_number, recipient_type, recipient_user_id, message_body, twilio_sid, status, error_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [alertId, phoneNumber, recipientType, recipientUserId, messageBody, twilioSid, status, errorMessage]);
  } catch (err) {
    console.error('SMS log error:', err);
  }
}

async function sendAlertNotification(alert) {
  try {
    // Get all managers with SMS enabled
    const managersResult = await db.query(`
      SELECT u.id, np.sms_phone_number
      FROM users u
      JOIN notification_preferences np ON u.id = np.user_id
      WHERE u.role = 'manager'
        AND np.sms_enabled = true
        AND np.sms_phone_number IS NOT NULL
        AND (
          (np.sms_on_burnout = true AND $1 = 'burnout')
          OR (np.sms_on_opportunity = true AND $1 = 'opportunity')
        )
    `, [alert.type]);

    const results = [];

    for (const manager of managersResult.rows) {
      const message = `[ShepHerd] ${alert.title}. ${alert.message}`;
      const result = await sendSMS(manager.sms_phone_number, message, alert.id, manager.id);
      results.push(result);
    }

    return results;
  } catch (err) {
    console.error('Send alert notification error:', err);
    return [{ success: false, error: err.message }];
  }
}

module.exports = {
  sendSMS,
  sendAlertNotification,
};
