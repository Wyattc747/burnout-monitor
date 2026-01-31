const nodemailer = require('nodemailer');
const db = require('../utils/db');

// Create transporter (use env vars in production)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a weekly wellness summary email
 */
async function sendWeeklySummary(userId, employeeId) {
  try {
    // Get user email
    const userResult = await db.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) return;

    const email = userResult.rows[0].email;

    // Get employee name
    const employeeResult = await db.query(
      'SELECT first_name, last_name FROM employees WHERE id = $1',
      [employeeId]
    );
    if (employeeResult.rows.length === 0) return;

    const { first_name, last_name } = employeeResult.rows[0];

    // Get weekly stats
    const statsResult = await db.query(`
      SELECT
        AVG(burnout_score) as avg_burnout,
        AVG(readiness_score) as avg_readiness,
        COUNT(*) as days_tracked,
        SUM(CASE WHEN zone = 'green' THEN 1 ELSE 0 END) as green_days,
        SUM(CASE WHEN zone = 'yellow' THEN 1 ELSE 0 END) as yellow_days,
        SUM(CASE WHEN zone = 'red' THEN 1 ELSE 0 END) as red_days
      FROM zone_history
      WHERE employee_id = $1
        AND date >= CURRENT_DATE - INTERVAL '7 days'
    `, [employeeId]);

    const stats = statsResult.rows[0];

    // Get health averages
    const healthResult = await db.query(`
      SELECT
        AVG(sleep_hours) as avg_sleep,
        AVG(sleep_quality_score) as avg_sleep_quality,
        AVG(steps) as avg_steps,
        AVG(exercise_minutes) as avg_exercise
      FROM health_metrics
      WHERE employee_id = $1
        AND date >= CURRENT_DATE - INTERVAL '7 days'
    `, [employeeId]);

    const health = healthResult.rows[0];

    // Get streak info
    const streakResult = await db.query(`
      SELECT current_checkin_streak, total_points
      FROM wellness_streaks
      WHERE employee_id = $1
    `, [employeeId]);

    const streak = streakResult.rows[0] || { current_checkin_streak: 0, total_points: 0 };

    // Build email content
    const avgReadiness = stats.avg_readiness ? parseFloat(stats.avg_readiness).toFixed(0) : 'N/A';
    const avgSleep = health.avg_sleep ? parseFloat(health.avg_sleep).toFixed(1) : 'N/A';
    const avgSteps = health.avg_steps ? Math.round(parseFloat(health.avg_steps)).toLocaleString() : 'N/A';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Weekly Wellness Summary</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #059669, #0d9488); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Herd Shepherd</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Your Weekly Wellness Summary</p>
                  </td>
                </tr>

                <!-- Greeting -->
                <tr>
                  <td style="padding: 30px 30px 20px 30px;">
                    <h2 style="color: #111827; margin: 0 0 10px 0; font-size: 20px;">Hi ${first_name}!</h2>
                    <p style="color: #6b7280; margin: 0; line-height: 1.6;">Here's your wellness summary for the past week.</p>
                  </td>
                </tr>

                <!-- Stats Grid -->
                <tr>
                  <td style="padding: 0 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50%" style="padding: 10px;">
                          <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; text-align: center;">
                            <p style="color: #059669; margin: 0; font-size: 12px; text-transform: uppercase;">Avg Readiness</p>
                            <p style="color: #111827; margin: 10px 0 0 0; font-size: 32px; font-weight: bold;">${avgReadiness}%</p>
                          </div>
                        </td>
                        <td width="50%" style="padding: 10px;">
                          <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; text-align: center;">
                            <p style="color: #d97706; margin: 0; font-size: 12px; text-transform: uppercase;">Check-in Streak</p>
                            <p style="color: #111827; margin: 10px 0 0 0; font-size: 32px; font-weight: bold;">${streak.current_checkin_streak} days</p>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" style="padding: 10px;">
                          <div style="background-color: #ede9fe; border-radius: 8px; padding: 20px; text-align: center;">
                            <p style="color: #7c3aed; margin: 0; font-size: 12px; text-transform: uppercase;">Avg Sleep</p>
                            <p style="color: #111827; margin: 10px 0 0 0; font-size: 32px; font-weight: bold;">${avgSleep}h</p>
                          </div>
                        </td>
                        <td width="50%" style="padding: 10px;">
                          <div style="background-color: #dbeafe; border-radius: 8px; padding: 20px; text-align: center;">
                            <p style="color: #2563eb; margin: 0; font-size: 12px; text-transform: uppercase;">Avg Steps</p>
                            <p style="color: #111827; margin: 10px 0 0 0; font-size: 32px; font-weight: bold;">${avgSteps}</p>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Zone Distribution -->
                <tr>
                  <td style="padding: 20px 30px;">
                    <h3 style="color: #111827; margin: 0 0 15px 0; font-size: 16px;">Zone Distribution</h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td>
                          <div style="display: flex; height: 12px; border-radius: 6px; overflow: hidden;">
                            <div style="background-color: #10b981; width: ${(stats.green_days / 7) * 100}%;"></div>
                            <div style="background-color: #f59e0b; width: ${(stats.yellow_days / 7) * 100}%;"></div>
                            <div style="background-color: #ef4444; width: ${(stats.red_days / 7) * 100}%;"></div>
                          </div>
                          <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 12px;">
                            ${stats.green_days || 0} green, ${stats.yellow_days || 0} yellow, ${stats.red_days || 0} red
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td style="padding: 20px 30px 30px 30px; text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600;">View Full Dashboard</a>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                    <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                      You're receiving this because you enabled weekly summaries.<br>
                      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings" style="color: #6b7280;">Update your preferences</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Herd Shepherd" <noreply@herdshepherd.com>',
      to: email,
      subject: `Your Weekly Wellness Summary - ${first_name}`,
      html,
    });

    console.log(`Sent weekly summary to ${email}`);
    return true;
  } catch (err) {
    console.error('Failed to send weekly summary:', err);
    return false;
  }
}

/**
 * Send all scheduled weekly summaries
 * This should be called by a cron job
 */
async function sendScheduledWeeklySummaries() {
  try {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().substring(0, 5);

    // Find users who should receive their weekly summary now
    const result = await db.query(`
      SELECT rs.user_id, e.id as employee_id
      FROM reminder_settings rs
      JOIN users u ON rs.user_id = u.id
      JOIN employees e ON u.id = e.user_id
      WHERE rs.weekly_summary_enabled = true
        AND rs.weekly_summary_day = $1
        AND rs.weekly_summary_time = $2
    `, [currentDay, currentTime]);

    console.log(`Sending weekly summaries to ${result.rows.length} users`);

    for (const row of result.rows) {
      await sendWeeklySummary(row.user_id, row.employee_id);
    }

    return result.rows.length;
  } catch (err) {
    console.error('Failed to send scheduled weekly summaries:', err);
    return 0;
  }
}

/**
 * Send a check-in reminder email
 */
async function sendCheckinReminder(userId, employeeId) {
  try {
    const userResult = await db.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) return;

    const employeeResult = await db.query(
      'SELECT first_name FROM employees WHERE id = $1',
      [employeeId]
    );
    if (employeeResult.rows.length === 0) return;

    const email = userResult.rows[0].email;
    const firstName = employeeResult.rows[0].first_name;

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f3f4f6;">
        <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 30px; text-align: center;">
          <h1 style="color: #059669; margin: 0 0 20px 0;">Good morning, ${firstName}!</h1>
          <p style="color: #6b7280; margin: 0 0 20px 0;">Time for your daily wellness check-in. How are you feeling today?</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: 600;">Check In Now</a>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Herd Shepherd" <noreply@herdshepherd.com>',
      to: email,
      subject: 'Daily Wellness Check-in Reminder',
      html,
    });

    console.log(`Sent check-in reminder to ${email}`);
    return true;
  } catch (err) {
    console.error('Failed to send check-in reminder:', err);
    return false;
  }
}

module.exports = {
  sendWeeklySummary,
  sendScheduledWeeklySummaries,
  sendCheckinReminder,
};
