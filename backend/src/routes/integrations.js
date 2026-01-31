const express = require('express');
const { authenticate } = require('../middleware/auth');
const salesforceService = require('../services/salesforceService');
const terraService = require('../services/terraService');
const googleCalendarService = require('../services/googleCalendarService');
const gmailService = require('../services/gmailService');
const slackService = require('../services/slackService');
const outlookService = require('../services/outlookService');
const jiraService = require('../services/jiraService');
const db = require('../utils/db');

const router = express.Router();

// ==================== STATUS ====================

// GET /api/integrations/status - Get all integration statuses
router.get('/status', authenticate, async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    // Get connected integrations
    const result = await db.query(`
      SELECT provider, status, updated_at
      FROM integration_connections
      WHERE employee_id = $1
    `, [employeeId]);

    const connections = {};
    for (const row of result.rows) {
      connections[row.provider] = {
        connected: row.status === 'active',
        lastSync: row.updated_at,
      };
    }

    // Check Google Calendar connection
    const googleConnected = await googleCalendarService.isConnected(req.user.userId);
    const gmailConnected = await gmailService.isGmailConnected(req.user.userId);

    res.json({
      salesforce: {
        configured: salesforceService.isConfigured(),
        connected: connections.salesforce?.connected || false,
        lastSync: connections.salesforce?.lastSync || null,
      },
      terra: {
        configured: terraService.isConfigured(),
        providers: {
          apple: connections.apple || { connected: false },
          fitbit: connections.fitbit || { connected: false },
          garmin: connections.garmin || { connected: false },
          oura: connections.oura || { connected: false },
        },
      },
      googleCalendar: {
        configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        connected: googleConnected,
      },
      gmail: {
        configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        connected: gmailConnected,
      },
    });
  } catch (err) {
    console.error('Get integration status error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get integration status' });
  }
});

// ==================== SALESFORCE ====================

// GET /api/integrations/salesforce/auth - Get Salesforce OAuth URL
router.get('/salesforce/auth', authenticate, (req, res) => {
  if (!salesforceService.isConfigured()) {
    return res.status(400).json({
      error: 'Not Configured',
      message: 'Salesforce integration is not configured. Please add SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET to your environment.',
    });
  }

  const state = Buffer.from(JSON.stringify({
    employeeId: req.user.employeeId,
    timestamp: Date.now(),
  })).toString('base64');

  const authUrl = salesforceService.getAuthUrl(state);
  res.json({ url: authUrl });
});

// GET /api/integrations/salesforce/callback - OAuth callback
router.get('/salesforce/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      console.error('Salesforce OAuth error:', error);
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding?step=work-systems&status=error&provider=salesforce`);
    }

    // Decode state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { employeeId } = stateData;

    // Exchange code for tokens
    const tokens = await salesforceService.exchangeCodeForTokens(code);

    // Store connection
    await salesforceService.storeConnection(employeeId, tokens);

    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding?step=work-systems&status=success&provider=salesforce`);
  } catch (err) {
    console.error('Salesforce callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/onboarding?step=work-systems&status=error&provider=salesforce`);
  }
});

// DELETE /api/integrations/salesforce - Disconnect Salesforce
router.delete('/salesforce', authenticate, async (req, res) => {
  try {
    await salesforceService.disconnect(req.user.employeeId);
    res.json({ success: true, message: 'Salesforce disconnected' });
  } catch (err) {
    console.error('Salesforce disconnect error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to disconnect Salesforce' });
  }
});

// GET /api/integrations/salesforce/sync - Manually sync Salesforce data
router.get('/salesforce/sync', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    const metrics = await salesforceService.fetchWorkMetrics(req.user.employeeId, start, end);

    if (!metrics) {
      return res.status(400).json({ error: 'Not Connected', message: 'Salesforce is not connected' });
    }

    res.json(metrics);
  } catch (err) {
    console.error('Salesforce sync error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to sync Salesforce data' });
  }
});

// ==================== TERRA (Health Devices) ====================

// POST /api/integrations/terra/widget - Get Terra widget session
router.post('/terra/widget', authenticate, async (req, res) => {
  try {
    if (!terraService.isConfigured()) {
      return res.status(400).json({
        error: 'Not Configured',
        message: 'Terra integration is not configured. Please add TERRA_API_KEY and TERRA_DEV_ID to your environment.',
      });
    }

    const { providers } = req.body;
    const session = await terraService.generateWidgetSession(
      req.user.employeeId,
      providers || ['APPLE', 'FITBIT', 'GARMIN', 'OURA']
    );

    res.json(session);
  } catch (err) {
    console.error('Terra widget error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to generate device connection' });
  }
});

// GET /api/integrations/terra/connections - Get connected health devices
router.get('/terra/connections', authenticate, async (req, res) => {
  try {
    const connections = await terraService.getConnections(req.user.employeeId);
    res.json(connections);
  } catch (err) {
    console.error('Terra connections error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get connections' });
  }
});

// DELETE /api/integrations/terra/:provider - Disconnect a health device
router.delete('/terra/:provider', authenticate, async (req, res) => {
  try {
    await terraService.disconnect(req.user.employeeId, req.params.provider);
    res.json({ success: true, message: `${req.params.provider} disconnected` });
  } catch (err) {
    console.error('Terra disconnect error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to disconnect device' });
  }
});

// POST /api/integrations/terra/webhook - Terra webhook endpoint
router.post('/terra/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['terra-signature'];
    const payload = req.body.toString();

    // Verify webhook signature
    if (!terraService.verifyWebhookSignature(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const webhookData = JSON.parse(payload);
    await terraService.processWebhook(webhookData);

    res.json({ received: true });
  } catch (err) {
    console.error('Terra webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ==================== GOOGLE CALENDAR ====================

// GET /api/integrations/google/auth - Get Google OAuth URL
router.get('/google/auth', authenticate, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({
      error: 'Not Configured',
      message: 'Google Calendar integration is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment.',
    });
  }

  const authUrl = googleCalendarService.getAuthUrl(req.user.userId);
  res.json({ url: authUrl });
});

// GET /api/integrations/google/callback - OAuth callback
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (error) {
      console.error('Google OAuth error:', error);
      return res.redirect(`${frontendUrl}/settings?status=error&provider=google`);
    }

    const userId = state; // We passed userId as state

    // Exchange code for tokens
    const tokens = await googleCalendarService.getTokensFromCode(code);

    // Store tokens
    await googleCalendarService.storeTokens(userId, tokens);

    res.redirect(`${frontendUrl}/settings?status=success&provider=google`);
  } catch (err) {
    console.error('Google callback error:', err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/settings?status=error&provider=google`);
  }
});

// DELETE /api/integrations/google - Disconnect Google Calendar
router.delete('/google', authenticate, async (req, res) => {
  try {
    await googleCalendarService.disconnect(req.user.userId);
    res.json({ success: true, message: 'Google Calendar disconnected' });
  } catch (err) {
    console.error('Google disconnect error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to disconnect Google Calendar' });
  }
});

// GET /api/integrations/google/events - Get calendar events
router.get('/google/events', authenticate, async (req, res) => {
  try {
    const isConnected = await googleCalendarService.isConnected(req.user.userId);
    if (!isConnected) {
      return res.status(400).json({ error: 'Not Connected', message: 'Google Calendar is not connected' });
    }

    const { days = 30 } = req.query;
    const metrics = await googleCalendarService.getDailyCalendarMetrics(req.user.userId, parseInt(days));
    res.json(metrics);
  } catch (err) {
    console.error('Google events error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to fetch calendar events' });
  }
});

// GET /api/integrations/google/upcoming - Get upcoming meetings
router.get('/google/upcoming', authenticate, async (req, res) => {
  try {
    const isConnected = await googleCalendarService.isConnected(req.user.userId);
    if (!isConnected) {
      return res.status(400).json({ error: 'Not Connected', message: 'Google Calendar is not connected' });
    }

    const { limit = 10 } = req.query;
    const meetings = await googleCalendarService.getUpcomingMeetings(req.user.userId, parseInt(limit));
    res.json(meetings);
  } catch (err) {
    console.error('Google upcoming error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to fetch upcoming meetings' });
  }
});

// ==================== GMAIL ====================

// GET /api/integrations/gmail/auth - Get Gmail OAuth URL (includes Calendar)
router.get('/gmail/auth', authenticate, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(400).json({
      error: 'Not Configured',
      message: 'Google integration is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment.',
    });
  }

  const authUrl = gmailService.getAuthUrlWithGmail(req.user.userId);
  res.json({ url: authUrl });
});

// GET /api/integrations/gmail/metrics - Get email metrics
router.get('/gmail/metrics', authenticate, async (req, res) => {
  try {
    const { limit = 30 } = req.query;

    // Always try to get stored metrics from database (includes seeded demo data)
    const metrics = await gmailService.getEmailMetrics(req.user.employeeId, parseInt(limit));

    // If no metrics found and Gmail not connected, return empty with message
    if (metrics.length === 0) {
      const isConnected = await gmailService.isGmailConnected(req.user.userId);
      if (!isConnected) {
        return res.status(400).json({ error: 'Not Connected', message: 'Gmail is not connected' });
      }
    }

    res.json(metrics);
  } catch (err) {
    console.error('Gmail metrics error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to fetch email metrics' });
  }
});

// POST /api/integrations/gmail/sync - Sync email metrics
router.post('/gmail/sync', authenticate, async (req, res) => {
  try {
    const isConnected = await gmailService.isGmailConnected(req.user.userId);
    if (!isConnected) {
      return res.status(400).json({ error: 'Not Connected', message: 'Gmail is not connected' });
    }

    const { days = 7 } = req.body;
    const metrics = await gmailService.syncEmailMetrics(req.user.userId, req.user.employeeId, days);
    res.json({ success: true, syncedDays: metrics.length, metrics });
  } catch (err) {
    console.error('Gmail sync error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to sync email metrics' });
  }
});

// ==================== SLACK ====================

// GET /api/integrations/slack/auth - Get Slack OAuth URL
router.get('/slack/auth', authenticate, (req, res) => {
  if (!slackService.isConfigured()) {
    return res.status(400).json({
      error: 'Not Configured',
      message: 'Slack integration is not configured.',
    });
  }

  const state = Buffer.from(JSON.stringify({
    userId: req.user.userId,
    timestamp: Date.now(),
  })).toString('base64');

  const authUrl = slackService.getAuthUrl(state);
  res.json({ url: authUrl });
});

// GET /api/integrations/slack/callback - OAuth callback
router.get('/slack/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${frontendUrl}/settings?status=error&provider=slack`);
    }

    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { userId } = stateData;

    const tokens = await slackService.exchangeCodeForTokens(code);
    await slackService.storeConnection(userId, tokens);

    res.redirect(`${frontendUrl}/settings?status=success&provider=slack`);
  } catch (err) {
    console.error('Slack callback error:', err);
    res.redirect(`${frontendUrl}/settings?status=error&provider=slack`);
  }
});

// DELETE /api/integrations/slack - Disconnect Slack
router.delete('/slack', authenticate, async (req, res) => {
  try {
    await slackService.disconnect(req.user.userId);
    res.json({ success: true, message: 'Slack disconnected' });
  } catch (err) {
    console.error('Slack disconnect error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to disconnect Slack' });
  }
});

// ==================== OUTLOOK ====================

// GET /api/integrations/outlook/auth - Get Outlook OAuth URL
router.get('/outlook/auth', authenticate, async (req, res) => {
  if (!outlookService.isConfigured()) {
    return res.status(400).json({
      error: 'Not Configured',
      message: 'Outlook integration is not configured.',
    });
  }

  const authUrl = await outlookService.getAuthUrl(req.user.userId);
  res.json({ url: authUrl });
});

// GET /api/integrations/outlook/callback - OAuth callback
router.get('/outlook/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${frontendUrl}/settings?status=error&provider=outlook`);
    }

    const userId = state;
    const tokens = await outlookService.exchangeCodeForTokens(code);
    await outlookService.storeConnection(userId, tokens);

    res.redirect(`${frontendUrl}/settings?status=success&provider=outlook`);
  } catch (err) {
    console.error('Outlook callback error:', err);
    res.redirect(`${frontendUrl}/settings?status=error&provider=outlook`);
  }
});

// DELETE /api/integrations/outlook - Disconnect Outlook
router.delete('/outlook', authenticate, async (req, res) => {
  try {
    await outlookService.disconnect(req.user.userId);
    res.json({ success: true, message: 'Outlook disconnected' });
  } catch (err) {
    console.error('Outlook disconnect error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to disconnect Outlook' });
  }
});

// GET /api/integrations/outlook/events - Get calendar events
router.get('/outlook/events', authenticate, async (req, res) => {
  try {
    const isConnected = await outlookService.isConnected(req.user.userId);
    if (!isConnected) {
      return res.status(400).json({ error: 'Not Connected', message: 'Outlook is not connected' });
    }

    const { days = 30 } = req.query;
    const metrics = await outlookService.getDailyCalendarMetrics(req.user.userId, parseInt(days));
    res.json(metrics);
  } catch (err) {
    console.error('Outlook events error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to fetch calendar events' });
  }
});

// ==================== JIRA ====================

// GET /api/integrations/jira/auth - Get Jira OAuth URL
router.get('/jira/auth', authenticate, (req, res) => {
  if (!jiraService.isConfigured()) {
    return res.status(400).json({
      error: 'Not Configured',
      message: 'Jira integration is not configured.',
    });
  }

  const state = Buffer.from(JSON.stringify({
    userId: req.user.userId,
    timestamp: Date.now(),
  })).toString('base64');

  const authUrl = jiraService.getAuthUrl(state);
  res.json({ url: authUrl });
});

// GET /api/integrations/jira/callback - OAuth callback
router.get('/jira/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${frontendUrl}/settings?status=error&provider=jira`);
    }

    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { userId } = stateData;

    const tokens = await jiraService.exchangeCodeForTokens(code);
    await jiraService.storeConnection(userId, tokens);

    res.redirect(`${frontendUrl}/settings?status=success&provider=jira`);
  } catch (err) {
    console.error('Jira callback error:', err);
    res.redirect(`${frontendUrl}/settings?status=error&provider=jira`);
  }
});

// DELETE /api/integrations/jira - Disconnect Jira
router.delete('/jira', authenticate, async (req, res) => {
  try {
    await jiraService.disconnect(req.user.userId);
    res.json({ success: true, message: 'Jira disconnected' });
  } catch (err) {
    console.error('Jira disconnect error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to disconnect Jira' });
  }
});

// GET /api/integrations/jira/issues - Get assigned issues
router.get('/jira/issues', authenticate, async (req, res) => {
  try {
    const isConnected = await jiraService.isConnected(req.user.userId);
    if (!isConnected) {
      return res.status(400).json({ error: 'Not Connected', message: 'Jira is not connected' });
    }

    const issues = await jiraService.getAssignedIssues(req.user.userId);
    res.json(issues);
  } catch (err) {
    console.error('Jira issues error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to fetch issues' });
  }
});

// GET /api/integrations/jira/metrics - Get work metrics from Jira
router.get('/jira/metrics', authenticate, async (req, res) => {
  try {
    const isConnected = await jiraService.isConnected(req.user.userId);
    if (!isConnected) {
      return res.status(400).json({ error: 'Not Connected', message: 'Jira is not connected' });
    }

    const { startDate, endDate } = req.query;
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    const metrics = await jiraService.getWorkMetrics(req.user.userId, start, end);
    res.json(metrics);
  } catch (err) {
    console.error('Jira metrics error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to fetch work metrics' });
  }
});

module.exports = router;
