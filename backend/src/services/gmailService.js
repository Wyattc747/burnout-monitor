const { google } = require('googleapis');
const db = require('../utils/db');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/integrations/google/callback'
);

// Gmail-specific scopes
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata',
];

// Combined scopes for Calendar + Gmail
const ALL_GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.metadata',
];

/**
 * Get OAuth URL with Gmail scopes
 */
function getAuthUrlWithGmail(userId) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ALL_GOOGLE_SCOPES,
    prompt: 'consent',
    state: userId,
  });
}

/**
 * Check if Gmail is connected for user
 */
async function isGmailConnected(userId) {
  const result = await db.query(`
    SELECT gmail_scope_enabled FROM google_calendar_tokens
    WHERE user_id = $1 AND expires_at > NOW()
  `, [userId]);

  return result.rows.length > 0 && result.rows[0].gmail_scope_enabled;
}

/**
 * Get authenticated Gmail client
 */
async function getGmailClient(userId) {
  const result = await db.query(`
    SELECT access_token, refresh_token, expires_at
    FROM google_calendar_tokens
    WHERE user_id = $1
  `, [userId]);

  if (result.rows.length === 0) {
    return null;
  }

  const { access_token, refresh_token, expires_at } = result.rows[0];

  oauth2Client.setCredentials({
    access_token,
    refresh_token,
    expiry_date: new Date(expires_at).getTime(),
  });

  // Refresh token if needed
  if (new Date(expires_at) < new Date()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await db.query(`
        UPDATE google_calendar_tokens
        SET access_token = $1, expires_at = $2, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $3
      `, [credentials.access_token, new Date(credentials.expiry_date), userId]);

      oauth2Client.setCredentials(credentials);
    } catch (err) {
      console.error('Failed to refresh Gmail token:', err);
      return null;
    }
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Fetch email metrics for a date range
 * Only fetches counts and timing metadata - never stores actual email content
 */
async function fetchEmailMetrics(userId, employeeId, startDate, endDate) {
  const gmail = await getGmailClient(userId);
  if (!gmail) {
    return null;
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Format dates for Gmail query
    const afterDate = Math.floor(start.getTime() / 1000);
    const beforeDate = Math.floor(end.getTime() / 1000);

    // Get sent emails count
    const sentQuery = `in:sent after:${afterDate} before:${beforeDate}`;
    const sentResult = await gmail.users.messages.list({
      userId: 'me',
      q: sentQuery,
      maxResults: 500,
    });
    const emailsSent = sentResult.data.resultSizeEstimate || 0;

    // Get received emails count
    const receivedQuery = `in:inbox after:${afterDate} before:${beforeDate}`;
    const receivedResult = await gmail.users.messages.list({
      userId: 'me',
      q: receivedQuery,
      maxResults: 500,
    });
    const emailsReceived = receivedResult.data.resultSizeEstimate || 0;

    // Get read emails count
    const readQuery = `in:inbox is:read after:${afterDate} before:${beforeDate}`;
    const readResult = await gmail.users.messages.list({
      userId: 'me',
      q: readQuery,
      maxResults: 500,
    });
    const emailsRead = readResult.data.resultSizeEstimate || 0;

    // Calculate outside hours emails (sent before 8am or after 6pm)
    let emailsOutsideHours = 0;
    let earliestTime = null;
    let latestTime = null;

    if (sentResult.data.messages && sentResult.data.messages.length > 0) {
      // Sample up to 50 sent messages to analyze timing
      const sampleMessages = sentResult.data.messages.slice(0, 50);

      for (const msg of sampleMessages) {
        try {
          const message = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['Date'],
          });

          const dateHeader = message.data.payload.headers.find(h => h.name === 'Date');
          if (dateHeader) {
            const sentDate = new Date(dateHeader.value);
            const hour = sentDate.getHours();
            const timeString = sentDate.toTimeString().substring(0, 5);

            if (hour < 8 || hour >= 18) {
              emailsOutsideHours++;
            }

            if (!earliestTime || timeString < earliestTime) {
              earliestTime = timeString;
            }
            if (!latestTime || timeString > latestTime) {
              latestTime = timeString;
            }
          }
        } catch (err) {
          // Skip message if can't fetch
        }
      }

      // Extrapolate outside hours for full set
      if (sampleMessages.length > 0) {
        emailsOutsideHours = Math.round((emailsOutsideHours / sampleMessages.length) * emailsSent);
      }
    }

    return {
      date: startDate,
      emailsReceived,
      emailsSent,
      emailsRead,
      emailsOutsideHours,
      earliestEmailTime: earliestTime,
      latestEmailTime: latestTime,
      activeThreads: emailsReceived + emailsSent,
    };
  } catch (err) {
    console.error('Gmail fetch error:', err);
    throw err;
  }
}

/**
 * Sync email metrics for the past N days
 */
async function syncEmailMetrics(userId, employeeId, days = 7) {
  const metrics = [];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    try {
      const dayMetrics = await fetchEmailMetrics(userId, employeeId, dateStr, dateStr);
      if (dayMetrics) {
        // Store in database
        await db.query(`
          INSERT INTO email_metrics (
            employee_id, date, emails_received, emails_sent, emails_read,
            emails_outside_hours, earliest_email_time, latest_email_time, active_threads
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (employee_id, date) DO UPDATE SET
            emails_received = $3,
            emails_sent = $4,
            emails_read = $5,
            emails_outside_hours = $6,
            earliest_email_time = $7,
            latest_email_time = $8,
            active_threads = $9,
            updated_at = CURRENT_TIMESTAMP
        `, [
          employeeId,
          dateStr,
          dayMetrics.emailsReceived,
          dayMetrics.emailsSent,
          dayMetrics.emailsRead,
          dayMetrics.emailsOutsideHours,
          dayMetrics.earliestEmailTime,
          dayMetrics.latestEmailTime,
          dayMetrics.activeThreads,
        ]);

        metrics.push(dayMetrics);
      }
    } catch (err) {
      console.error(`Failed to sync email metrics for ${dateStr}:`, err);
    }
  }

  return metrics;
}

/**
 * Get stored email metrics
 */
async function getEmailMetrics(employeeId, limit = 30) {
  const result = await db.query(`
    SELECT date, emails_received, emails_sent, emails_read,
           avg_response_time_minutes, emails_responded,
           emails_outside_hours, earliest_email_time, latest_email_time,
           active_threads
    FROM email_metrics
    WHERE employee_id = $1
    ORDER BY date DESC
    LIMIT $2
  `, [employeeId, limit]);

  return result.rows.map(row => ({
    date: row.date,
    emailsReceived: row.emails_received,
    emailsSent: row.emails_sent,
    emailsRead: row.emails_read,
    avgResponseTimeMinutes: row.avg_response_time_minutes,
    emailsResponded: row.emails_responded,
    emailsOutsideHours: row.emails_outside_hours,
    earliestEmailTime: row.earliest_email_time,
    latestEmailTime: row.latest_email_time,
    activeThreads: row.active_threads,
  }));
}

/**
 * Enable Gmail scope for existing Google connection
 */
async function enableGmailScope(userId) {
  await db.query(`
    UPDATE google_calendar_tokens
    SET gmail_scope_enabled = true, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
  `, [userId]);
}

module.exports = {
  getAuthUrlWithGmail,
  isGmailConnected,
  fetchEmailMetrics,
  syncEmailMetrics,
  getEmailMetrics,
  enableGmailScope,
  ALL_GOOGLE_SCOPES,
};
