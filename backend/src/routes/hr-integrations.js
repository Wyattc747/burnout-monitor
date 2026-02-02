const express = require('express');
const crypto = require('crypto');
const db = require('../utils/db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireOrganization, logAuditAction } = require('../middleware/tenant');
const hrIntegrations = require('../services/hrIntegrations');

const router = express.Router();

// All routes require authentication, organization, and admin privileges
router.use(authenticate);
router.use(requireOrganization);

// GET /api/hr-integrations - List available providers and connected integrations
router.get('/', requirePermission('integrations:read'), async (req, res) => {
  try {
    // Get connected integrations for this org
    const result = await db.query(
      `SELECT id, provider, status, sync_frequency, last_sync_at, last_error, last_error_at,
              consecutive_failures, auto_sync_enabled, created_at, updated_at
       FROM hr_integrations WHERE organization_id = $1`,
      [req.user.organizationId]
    );

    const connected = {};
    result.rows.forEach(row => {
      connected[row.provider] = {
        id: row.id,
        status: row.status,
        syncFrequency: row.sync_frequency,
        lastSyncAt: row.last_sync_at,
        lastError: row.last_error,
        lastErrorAt: row.last_error_at,
        consecutiveFailures: row.consecutive_failures,
        autoSyncEnabled: row.auto_sync_enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    // Get available providers
    const providers = hrIntegrations.getAvailableProviders().map(provider => ({
      ...provider,
      connected: connected[provider.id] || null,
    }));

    res.json({ providers });
  } catch (err) {
    console.error('List integrations error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to list integrations' });
  }
});

// GET /api/hr-integrations/:provider - Get integration details
router.get('/:provider', requirePermission('integrations:read'), async (req, res) => {
  try {
    const { provider } = req.params;

    // Get provider info
    const providerInfo = hrIntegrations.getProviderInfo(provider);
    if (!providerInfo) {
      return res.status(404).json({ error: 'Not Found', message: 'Unknown provider' });
    }

    // Get integration if connected
    const result = await db.query(
      `SELECT * FROM hr_integrations WHERE organization_id = $1 AND provider = $2`,
      [req.user.organizationId, provider]
    );

    const integration = result.rows[0];

    res.json({
      provider: providerInfo,
      integration: integration
        ? {
            id: integration.id,
            status: integration.status,
            syncFrequency: integration.sync_frequency,
            autoSyncEnabled: integration.auto_sync_enabled,
            lastSyncAt: integration.last_sync_at,
            nextSyncAt: integration.next_sync_at,
            lastError: integration.last_error,
            fieldMappings: integration.field_mappings,
            providerSettings: integration.provider_settings,
            createdAt: integration.created_at,
          }
        : null,
    });
  } catch (err) {
    console.error('Get integration error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get integration' });
  }
});

// POST /api/hr-integrations/:provider/connect - Connect integration
router.post('/:provider/connect', requirePermission('integrations:create'), async (req, res) => {
  const client = await db.getClient();
  try {
    const { provider } = req.params;
    const { credentials, providerSettings = {} } = req.body;

    // Validate provider
    const providerInfo = hrIntegrations.getProviderInfo(provider);
    if (!providerInfo) {
      return res.status(404).json({ error: 'Not Found', message: 'Unknown provider' });
    }

    // Validate credentials
    const validation = hrIntegrations.validateCredentials(provider, credentials);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid credentials',
        errors: validation.errors,
      });
    }

    // Check if already connected
    const existing = await client.query(
      `SELECT id FROM hr_integrations WHERE organization_id = $1 AND provider = $2`,
      [req.user.organizationId, provider]
    );

    if (existing.rows.length > 0) {
      client.release();
      return res.status(400).json({
        error: 'Already Connected',
        message: 'This provider is already connected. Disconnect first to reconnect.',
      });
    }

    await client.query('BEGIN');

    // Create integration record
    const result = await client.query(
      `INSERT INTO hr_integrations (organization_id, provider, status, encrypted_credentials, provider_settings)
       VALUES ($1, $2, 'pending', $3, $4)
       RETURNING id`,
      [req.user.organizationId, provider, JSON.stringify(credentials), JSON.stringify(providerSettings)]
    );

    const integrationId = result.rows[0].id;

    // Test connection
    const integrationRecord = {
      id: integrationId,
      organization_id: req.user.organizationId,
      provider,
      encrypted_credentials: credentials,
      provider_settings: providerSettings,
      field_mappings: {},
    };

    const testResult = await hrIntegrations.testConnection(integrationRecord);

    if (!testResult.success) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        error: 'Connection Failed',
        message: testResult.error || 'Failed to connect to provider',
      });
    }

    // Update status to connected
    await client.query(
      `UPDATE hr_integrations SET status = 'connected' WHERE id = $1`,
      [integrationId]
    );

    await client.query('COMMIT');

    // Log audit action
    await logAuditAction(req, 'integration.connected', 'hr_integration', integrationId, null, { provider });

    res.status(201).json({
      id: integrationId,
      provider,
      status: 'connected',
      message: `Successfully connected to ${providerInfo.name}`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Connect integration error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to connect integration' });
  } finally {
    client.release();
  }
});

// POST /api/hr-integrations/:provider/oauth/authorize - Get OAuth authorization URL
router.post('/:provider/oauth/authorize', requirePermission('integrations:create'), async (req, res) => {
  try {
    const { provider } = req.params;
    const { redirectUri } = req.body;

    const providerInfo = hrIntegrations.getProviderInfo(provider);
    if (!providerInfo) {
      return res.status(404).json({ error: 'Not Found', message: 'Unknown provider' });
    }

    if (providerInfo.authType !== 'oauth' && providerInfo.authType !== 'hybrid') {
      return res.status(400).json({
        error: 'Invalid Operation',
        message: 'This provider does not use OAuth',
      });
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');

    // Store state in session or database for verification
    await db.query(
      `INSERT INTO hr_integrations (organization_id, provider, status, provider_settings)
       VALUES ($1, $2, 'pending', $3)
       ON CONFLICT (organization_id, provider) DO UPDATE SET provider_settings = $3`,
      [req.user.organizationId, provider, JSON.stringify({ oauth_state: state })]
    );

    // Create temporary adapter to get auth URL
    const AdapterClass = hrIntegrations.getAdapterClass(provider);
    const tempIntegration = {
      organization_id: req.user.organizationId,
      provider,
      encrypted_credentials: req.body.credentials || {},
      provider_settings: req.body.providerSettings || {},
    };
    const adapter = new AdapterClass(tempIntegration);

    const authUrl = adapter.getAuthorizationUrl(redirectUri, state);

    if (!authUrl) {
      return res.status(400).json({
        error: 'Invalid Operation',
        message: 'Could not generate authorization URL',
      });
    }

    res.json({ authorizationUrl: authUrl, state });
  } catch (err) {
    console.error('OAuth authorize error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to generate authorization URL' });
  }
});

// POST /api/hr-integrations/:provider/oauth/callback - Handle OAuth callback
router.post('/:provider/oauth/callback', requirePermission('integrations:create'), async (req, res) => {
  const client = await db.getClient();
  try {
    const { provider } = req.params;
    const { code, state, redirectUri } = req.body;

    // Verify state
    const stateCheck = await client.query(
      `SELECT id, provider_settings FROM hr_integrations
       WHERE organization_id = $1 AND provider = $2`,
      [req.user.organizationId, provider]
    );

    if (stateCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid Request', message: 'No pending OAuth flow' });
    }

    const integration = stateCheck.rows[0];
    const savedState = integration.provider_settings?.oauth_state;

    if (savedState !== state) {
      return res.status(400).json({ error: 'Invalid Request', message: 'Invalid state parameter' });
    }

    // Exchange code for tokens
    const AdapterClass = hrIntegrations.getAdapterClass(provider);
    const tempIntegration = {
      ...integration,
      organization_id: req.user.organizationId,
      provider,
      encrypted_credentials: req.body.credentials || {},
      provider_settings: integration.provider_settings || {},
    };
    const adapter = new AdapterClass(tempIntegration);

    const tokens = await adapter.exchangeCodeForTokens(code, redirectUri);

    if (!tokens) {
      return res.status(400).json({ error: 'OAuth Failed', message: 'Failed to exchange code for tokens' });
    }

    await client.query('BEGIN');

    // Update integration with tokens
    await client.query(
      `UPDATE hr_integrations
       SET encrypted_credentials = $1, status = 'connected', provider_settings = provider_settings - 'oauth_state'
       WHERE id = $2`,
      [JSON.stringify(tokens), integration.id]
    );

    await client.query('COMMIT');

    // Log audit action
    await logAuditAction(req, 'integration.connected', 'hr_integration', integration.id, null, { provider });

    res.json({
      id: integration.id,
      provider,
      status: 'connected',
      message: 'Successfully authenticated',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('OAuth callback error:', err);
    res.status(500).json({ error: 'Server Error', message: 'OAuth callback failed' });
  } finally {
    client.release();
  }
});

// DELETE /api/hr-integrations/:provider - Disconnect integration
router.delete('/:provider', requirePermission('integrations:delete'), async (req, res) => {
  try {
    const { provider } = req.params;

    const result = await db.query(
      `DELETE FROM hr_integrations WHERE organization_id = $1 AND provider = $2 RETURNING id`,
      [req.user.organizationId, provider]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Integration not found' });
    }

    // Log audit action
    await logAuditAction(req, 'integration.disconnected', 'hr_integration', result.rows[0].id, { provider }, null);

    res.json({ message: `Successfully disconnected ${provider}` });
  } catch (err) {
    console.error('Disconnect integration error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to disconnect integration' });
  }
});

// POST /api/hr-integrations/:provider/sync - Trigger manual sync
router.post('/:provider/sync', requirePermission('integrations:sync'), async (req, res) => {
  try {
    const { provider } = req.params;
    const { dryRun = false } = req.body;

    // Get integration
    const result = await db.query(
      `SELECT * FROM hr_integrations WHERE organization_id = $1 AND provider = $2`,
      [req.user.organizationId, provider]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Integration not found' });
    }

    const integration = result.rows[0];

    if (integration.status !== 'connected') {
      return res.status(400).json({
        error: 'Invalid Status',
        message: 'Integration must be connected to sync',
      });
    }

    // Create sync service and run sync
    const syncService = hrIntegrations.createSyncService(integration, { dryRun });
    const syncResult = await syncService.runSync('manual', req.user.userId);

    res.json({
      success: true,
      logId: syncResult.logId,
      stats: syncResult.stats,
      duration: syncResult.duration,
      dryRun,
    });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Sync failed: ' + err.message });
  }
});

// GET /api/hr-integrations/:provider/preview - Preview import before sync
router.get('/:provider/preview', requirePermission('integrations:sync'), async (req, res) => {
  try {
    const { provider } = req.params;

    // Get integration
    const result = await db.query(
      `SELECT * FROM hr_integrations WHERE organization_id = $1 AND provider = $2`,
      [req.user.organizationId, provider]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Integration not found' });
    }

    const integration = result.rows[0];

    if (integration.status !== 'connected') {
      return res.status(400).json({
        error: 'Invalid Status',
        message: 'Integration must be connected to preview',
      });
    }

    // Create sync service and run preview (dry run)
    const syncService = hrIntegrations.createSyncService(integration, { dryRun: true });
    const previewResult = await syncService.preview();

    res.json({
      stats: previewResult.stats,
      message: `Preview: ${previewResult.stats.employeesCreated} would be created, ${previewResult.stats.employeesUpdated} updated, ${previewResult.stats.employeesDeactivated} deactivated`,
    });
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Preview failed: ' + err.message });
  }
});

// GET /api/hr-integrations/:provider/logs - Get sync history
router.get('/:provider/logs', requirePermission('integrations:read'), async (req, res) => {
  try {
    const { provider } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    // Get integration
    const intResult = await db.query(
      `SELECT id FROM hr_integrations WHERE organization_id = $1 AND provider = $2`,
      [req.user.organizationId, provider]
    );

    if (intResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Integration not found' });
    }

    const integrationId = intResult.rows[0].id;

    // Get logs
    const result = await db.query(
      `SELECT * FROM hr_sync_logs
       WHERE hr_integration_id = $1
       ORDER BY started_at DESC
       LIMIT $2 OFFSET $3`,
      [integrationId, Math.min(parseInt(limit), 100), parseInt(offset)]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) FROM hr_sync_logs WHERE hr_integration_id = $1`,
      [integrationId]
    );

    res.json({
      logs: result.rows.map(row => ({
        id: row.id,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        syncType: row.sync_type,
        status: row.status,
        employeesCreated: row.employees_created,
        employeesUpdated: row.employees_updated,
        employeesDeactivated: row.employees_deactivated,
        departmentsSynced: row.departments_synced,
        errors: row.errors,
        summary: row.summary,
      })),
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to get sync logs' });
  }
});

// PUT /api/hr-integrations/:provider/mappings - Update field mappings
router.put('/:provider/mappings', requirePermission('integrations:update'), async (req, res) => {
  try {
    const { provider } = req.params;
    const { fieldMappings } = req.body;

    if (!fieldMappings || typeof fieldMappings !== 'object') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'fieldMappings object is required',
      });
    }

    const result = await db.query(
      `UPDATE hr_integrations SET field_mappings = $1, updated_at = NOW()
       WHERE organization_id = $2 AND provider = $3
       RETURNING id, field_mappings`,
      [JSON.stringify(fieldMappings), req.user.organizationId, provider]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Integration not found' });
    }

    res.json({
      id: result.rows[0].id,
      fieldMappings: result.rows[0].field_mappings,
    });
  } catch (err) {
    console.error('Update mappings error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update field mappings' });
  }
});

// PUT /api/hr-integrations/:provider/settings - Update sync settings
router.put('/:provider/settings', requirePermission('integrations:update'), async (req, res) => {
  try {
    const { provider } = req.params;
    const { syncFrequency, autoSyncEnabled } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (syncFrequency !== undefined) {
      const validFrequencies = ['manual', 'hourly', 'daily', 'weekly'];
      if (!validFrequencies.includes(syncFrequency)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Invalid sync frequency' });
      }
      updates.push(`sync_frequency = $${paramIndex++}`);
      values.push(syncFrequency);
    }

    if (autoSyncEnabled !== undefined) {
      updates.push(`auto_sync_enabled = $${paramIndex++}`);
      values.push(autoSyncEnabled);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Validation Error', message: 'No settings to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.user.organizationId, provider);

    const result = await db.query(
      `UPDATE hr_integrations SET ${updates.join(', ')}
       WHERE organization_id = $${paramIndex++} AND provider = $${paramIndex}
       RETURNING id, sync_frequency, auto_sync_enabled`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Integration not found' });
    }

    res.json({
      id: result.rows[0].id,
      syncFrequency: result.rows[0].sync_frequency,
      autoSyncEnabled: result.rows[0].auto_sync_enabled,
    });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Server Error', message: 'Failed to update settings' });
  }
});

module.exports = router;
