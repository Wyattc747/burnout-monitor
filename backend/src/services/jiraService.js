const db = require('../utils/db');

// Jira OAuth configuration
const JIRA_CLIENT_ID = process.env.JIRA_CLIENT_ID;
const JIRA_CLIENT_SECRET = process.env.JIRA_CLIENT_SECRET;
const JIRA_REDIRECT_URI = process.env.JIRA_REDIRECT_URI || 'http://localhost:3001/api/integrations/jira/callback';

const SCOPES = ['read:jira-work', 'read:jira-user', 'offline_access'].join(' ');

/**
 * Check if Jira is configured
 */
function isConfigured() {
  return !!(JIRA_CLIENT_ID && JIRA_CLIENT_SECRET);
}

/**
 * Get OAuth URL for Jira
 */
function getAuthUrl(state) {
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: JIRA_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: JIRA_REDIRECT_URI,
    state,
    response_type: 'code',
    prompt: 'consent',
  });

  return `https://auth.atlassian.com/authorize?${params.toString()}`;
}

/**
 * Exchange code for tokens
 */
async function exchangeCodeForTokens(code) {
  const response = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: JIRA_CLIENT_ID,
      client_secret: JIRA_CLIENT_SECRET,
      code,
      redirect_uri: JIRA_REDIRECT_URI,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  // Get accessible resources (sites)
  const resourcesRes = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: {
      Authorization: `Bearer ${data.access_token}`,
    },
  });

  const resources = await resourcesRes.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
    sites: resources,
  };
}

/**
 * Store Jira connection
 */
async function storeConnection(userId, tokens) {
  await db.query(`
    INSERT INTO integration_connections (employee_id, provider, status, credentials)
    SELECT e.id, 'jira', 'active', $2
    FROM employees e
    JOIN users u ON e.user_id = u.id
    WHERE u.id = $1
    ON CONFLICT (employee_id, provider) DO UPDATE SET
      status = 'active',
      credentials = $2,
      updated_at = CURRENT_TIMESTAMP
  `, [userId, JSON.stringify(tokens)]);
}

/**
 * Check if Jira is connected for user
 */
async function isConnected(userId) {
  const result = await db.query(`
    SELECT ic.status
    FROM integration_connections ic
    JOIN employees e ON ic.employee_id = e.id
    JOIN users u ON e.user_id = u.id
    WHERE u.id = $1 AND ic.provider = 'jira' AND ic.status = 'active'
  `, [userId]);

  return result.rows.length > 0;
}

/**
 * Get authenticated client for Jira API
 */
async function getJiraClient(userId) {
  const result = await db.query(`
    SELECT ic.credentials
    FROM integration_connections ic
    JOIN employees e ON ic.employee_id = e.id
    JOIN users u ON e.user_id = u.id
    WHERE u.id = $1 AND ic.provider = 'jira' AND ic.status = 'active'
  `, [userId]);

  if (result.rows.length === 0) return null;

  let credentials = result.rows[0].credentials;

  // Refresh token if expired
  if (new Date(credentials.expiresAt) < new Date()) {
    try {
      const response = await fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: JIRA_CLIENT_ID,
          client_secret: JIRA_CLIENT_SECRET,
          refresh_token: credentials.refreshToken,
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      credentials = {
        ...credentials,
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };

      await storeConnection(userId, credentials);
    } catch (err) {
      console.error('Failed to refresh Jira token:', err);
      return null;
    }
  }

  return {
    accessToken: credentials.accessToken,
    cloudId: credentials.sites?.[0]?.id,
    siteUrl: credentials.sites?.[0]?.url,
  };
}

/**
 * Get assigned issues for user
 */
async function getAssignedIssues(userId) {
  const client = await getJiraClient(userId);
  if (!client) return null;

  try {
    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${client.cloudId}/rest/api/3/search?jql=assignee=currentUser()&maxResults=50`,
      {
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    const data = await response.json();

    return data.issues?.map((issue) => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name,
      priority: issue.fields.priority?.name,
      issueType: issue.fields.issuetype?.name,
      dueDate: issue.fields.duedate,
      created: issue.fields.created,
      updated: issue.fields.updated,
    })) || [];
  } catch (err) {
    console.error('Failed to fetch Jira issues:', err);
    throw err;
  }
}

/**
 * Get work metrics from Jira
 */
async function getWorkMetrics(userId, startDate, endDate) {
  const client = await getJiraClient(userId);
  if (!client) return null;

  try {
    // Get issues updated in date range
    const jql = `assignee=currentUser() AND updated >= "${startDate}" AND updated <= "${endDate}"`;

    const response = await fetch(
      `https://api.atlassian.com/ex/jira/${client.cloudId}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=100`,
      {
        headers: {
          Authorization: `Bearer ${client.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    const data = await response.json();
    const issues = data.issues || [];

    // Calculate metrics
    const completedIssues = issues.filter((i) => i.fields.status?.statusCategory?.key === 'done');
    const inProgressIssues = issues.filter((i) => i.fields.status?.statusCategory?.key === 'indeterminate');

    return {
      totalIssues: issues.length,
      completedIssues: completedIssues.length,
      inProgressIssues: inProgressIssues.length,
      issues: issues.map((issue) => ({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name,
        updated: issue.fields.updated,
      })),
    };
  } catch (err) {
    console.error('Failed to fetch Jira work metrics:', err);
    throw err;
  }
}

/**
 * Disconnect Jira
 */
async function disconnect(userId) {
  await db.query(`
    UPDATE integration_connections ic
    SET status = 'disconnected', updated_at = CURRENT_TIMESTAMP
    FROM employees e, users u
    WHERE ic.employee_id = e.id
      AND e.user_id = u.id
      AND u.id = $1
      AND ic.provider = 'jira'
  `, [userId]);
}

module.exports = {
  isConfigured,
  getAuthUrl,
  exchangeCodeForTokens,
  storeConnection,
  isConnected,
  getAssignedIssues,
  getWorkMetrics,
  disconnect,
};
