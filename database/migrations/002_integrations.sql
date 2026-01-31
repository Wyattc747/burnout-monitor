-- Migration: Add Integration Connections
-- For Salesforce, Terra (Apple Health), and other integrations

-- ============================================
-- INTEGRATION CONNECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS integration_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Provider identification
    provider VARCHAR(50) NOT NULL,  -- 'salesforce', 'apple', 'fitbit', 'garmin', 'oura', 'jira', 'slack', etc.

    -- OAuth tokens (for Salesforce, etc.)
    access_token TEXT,
    refresh_token TEXT,
    instance_url VARCHAR(255),      -- For Salesforce instance URL
    expires_at TIMESTAMP WITH TIME ZONE,

    -- External user IDs (for Terra, etc.)
    external_user_id VARCHAR(255),

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Each employee can only have one connection per provider
    UNIQUE(employee_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_employee ON integration_connections(employee_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_provider ON integration_connections(provider);

-- ============================================
-- ADD SOURCE COLUMN TO HEALTH METRICS
-- ============================================
-- Track where health data came from (synthetic, apple, fitbit, etc.)
ALTER TABLE health_metrics
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'synthetic';

ALTER TABLE health_metrics
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- ============================================
-- ADD SOURCE COLUMN TO WORK METRICS
-- ============================================
-- Track where work data came from (synthetic, salesforce, jira, etc.)
ALTER TABLE work_metrics
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'synthetic';

ALTER TABLE work_metrics
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- ============================================
-- INTEGRATION SYNC LOGS
-- ============================================
-- Track sync history for debugging
CREATE TABLE IF NOT EXISTS integration_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,

    sync_type VARCHAR(50),          -- 'health', 'work', 'full'
    status VARCHAR(20) NOT NULL,    -- 'success', 'partial', 'failed'
    records_synced INTEGER DEFAULT 0,
    error_message TEXT,

    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_employee ON integration_sync_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_provider ON integration_sync_logs(provider);
