-- Migration: B2B Multi-Tenant Foundation
-- Creates the core tables for B2B multi-tenancy support

-- ============================================
-- ORGANIZATIONS TABLE
-- ============================================
-- Core tenant table for multi-tenancy
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,  -- URL-friendly identifier (e.g., acme-corp)
    domain VARCHAR(255),                 -- Primary email domain (for SSO)

    -- Branding
    logo_url VARCHAR(500),
    primary_color VARCHAR(7),            -- Hex color code

    -- Subscription info
    subscription_tier VARCHAR(50) DEFAULT 'trial' CHECK (subscription_tier IN ('trial', 'starter', 'professional', 'enterprise')),
    subscription_status VARCHAR(50) DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing')),
    trial_ends_at TIMESTAMP WITH TIME ZONE,

    -- Stripe integration
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),

    -- Limits
    max_employees INTEGER DEFAULT 10,    -- Based on subscription tier

    -- Settings (flexible JSON for org-specific config)
    settings JSONB DEFAULT '{}',

    -- Metadata
    industry VARCHAR(100),
    company_size VARCHAR(50) CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_domain ON organizations(domain);
CREATE INDEX idx_organizations_stripe_customer ON organizations(stripe_customer_id);
CREATE INDEX idx_organizations_subscription ON organizations(subscription_tier, subscription_status);

-- ============================================
-- DEPARTMENTS TABLE
-- ============================================
-- Hierarchical departments/teams within organizations
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Department info
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),                    -- Short code (e.g., ENG, MKT, HR)
    description TEXT,

    -- Hierarchy (self-referential for unlimited nesting)
    parent_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    hierarchy_level INTEGER DEFAULT 0,   -- Computed depth for easier queries (0 = root)
    hierarchy_path TEXT,                 -- Materialized path for efficient tree queries (e.g., /uuid1/uuid2/uuid3)

    -- Department manager (employee who manages this department)
    manager_employee_id UUID,            -- Will be FK after employees table is modified

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Sort order for display
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique department name within an organization at the same level
    UNIQUE(organization_id, name, parent_department_id)
);

CREATE INDEX idx_departments_organization ON departments(organization_id);
CREATE INDEX idx_departments_parent ON departments(parent_department_id);
CREATE INDEX idx_departments_manager ON departments(manager_employee_id);
CREATE INDEX idx_departments_hierarchy ON departments(organization_id, hierarchy_level);
CREATE INDEX idx_departments_path ON departments(hierarchy_path);

-- ============================================
-- HR INTEGRATIONS TABLE
-- ============================================
-- Tracks connected HR system integrations
CREATE TABLE IF NOT EXISTS hr_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Provider info
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('bamboohr', 'workday', 'adp', 'gusto', 'rippling')),

    -- Connection status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'error', 'disconnected')),

    -- Credentials (encrypted in application layer)
    encrypted_credentials JSONB,         -- OAuth tokens, API keys, etc.

    -- Sync configuration
    sync_frequency VARCHAR(50) DEFAULT 'daily' CHECK (sync_frequency IN ('manual', 'hourly', 'daily', 'weekly')),
    auto_sync_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    next_sync_at TIMESTAMP WITH TIME ZONE,

    -- Field mappings (how HR fields map to our schema)
    field_mappings JSONB DEFAULT '{}',

    -- Provider-specific settings
    provider_settings JSONB DEFAULT '{}', -- e.g., subdomain for BambooHR

    -- Error tracking
    last_error TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE,
    consecutive_failures INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Only one integration per provider per organization
    UNIQUE(organization_id, provider)
);

CREATE INDEX idx_hr_integrations_organization ON hr_integrations(organization_id);
CREATE INDEX idx_hr_integrations_provider ON hr_integrations(provider);
CREATE INDEX idx_hr_integrations_status ON hr_integrations(status);
CREATE INDEX idx_hr_integrations_next_sync ON hr_integrations(next_sync_at) WHERE auto_sync_enabled = true;

-- ============================================
-- HR SYNC LOGS TABLE
-- ============================================
-- Audit trail of HR data synchronizations
CREATE TABLE IF NOT EXISTS hr_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hr_integration_id UUID NOT NULL REFERENCES hr_integrations(id) ON DELETE CASCADE,

    -- Sync timing
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,

    -- Sync type
    sync_type VARCHAR(50) DEFAULT 'scheduled' CHECK (sync_type IN ('manual', 'scheduled', 'webhook')),

    -- Status
    status VARCHAR(50) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),

    -- Statistics
    employees_created INTEGER DEFAULT 0,
    employees_updated INTEGER DEFAULT 0,
    employees_deactivated INTEGER DEFAULT 0,
    departments_synced INTEGER DEFAULT 0,

    -- Errors (array of error objects)
    errors JSONB DEFAULT '[]',

    -- Summary message
    summary TEXT,

    -- Triggered by (user who triggered manual sync, or 'system' for scheduled)
    triggered_by UUID REFERENCES users(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hr_sync_logs_integration ON hr_sync_logs(hr_integration_id);
CREATE INDEX idx_hr_sync_logs_status ON hr_sync_logs(status);
CREATE INDEX idx_hr_sync_logs_started ON hr_sync_logs(started_at DESC);

-- ============================================
-- EMPLOYEE INVITATIONS TABLE
-- ============================================
-- Tracks pending and completed employee invitations
CREATE TABLE IF NOT EXISTS employee_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Invitation target
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),

    -- Role and placement
    role VARCHAR(50) DEFAULT 'employee' CHECK (role IN ('super_admin', 'admin', 'manager', 'employee')),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    job_title VARCHAR(100),

    -- Reporting relationship
    reports_to_id UUID,                  -- Will be FK to employees after modification

    -- Invitation tracking
    token VARCHAR(255) UNIQUE NOT NULL,  -- Secure token for invitation URL
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    accepted_at TIMESTAMP WITH TIME ZONE,

    -- Who sent the invitation
    invited_by UUID NOT NULL REFERENCES users(id),

    -- Batch tracking (for bulk invitations)
    batch_id UUID,

    -- Employee created upon acceptance
    employee_id UUID,                    -- Will be FK to employees after modification

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invitations_organization ON employee_invitations(organization_id);
CREATE INDEX idx_invitations_email ON employee_invitations(email);
CREATE INDEX idx_invitations_token ON employee_invitations(token);
CREATE INDEX idx_invitations_status ON employee_invitations(status);
CREATE INDEX idx_invitations_batch ON employee_invitations(batch_id);
CREATE INDEX idx_invitations_pending ON employee_invitations(status, expires_at) WHERE status = 'pending';

-- ============================================
-- ORGANIZATION AUDIT LOG TABLE
-- ============================================
-- Tracks admin actions for compliance and debugging
CREATE TABLE IF NOT EXISTS organization_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Who performed the action
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),             -- Preserved even if user is deleted

    -- What action was performed
    action VARCHAR(100) NOT NULL,        -- e.g., 'employee.invited', 'department.created', 'role.changed'
    resource_type VARCHAR(100),          -- e.g., 'employee', 'department', 'integration'
    resource_id UUID,

    -- Details of the change
    old_values JSONB,
    new_values JSONB,

    -- Request metadata
    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_organization ON organization_audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user ON organization_audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON organization_audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON organization_audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON organization_audit_logs(created_at DESC);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE organizations IS 'Multi-tenant organizations (companies) that subscribe to ShepHerd';
COMMENT ON TABLE departments IS 'Hierarchical departments within organizations supporting unlimited nesting';
COMMENT ON TABLE hr_integrations IS 'Connected HR system integrations (BambooHR, Workday, ADP, Gusto, Rippling)';
COMMENT ON TABLE hr_sync_logs IS 'Audit trail of HR data synchronization operations';
COMMENT ON TABLE employee_invitations IS 'Pending and completed employee invitations';
COMMENT ON TABLE organization_audit_logs IS 'Admin action audit trail for compliance';

COMMENT ON COLUMN organizations.slug IS 'URL-friendly unique identifier (e.g., acme-corp)';
COMMENT ON COLUMN organizations.domain IS 'Primary email domain for SSO and auto-org detection';
COMMENT ON COLUMN departments.hierarchy_path IS 'Materialized path for efficient ancestor/descendant queries';
COMMENT ON COLUMN hr_integrations.encrypted_credentials IS 'OAuth tokens and API keys (encrypted in application layer)';
COMMENT ON COLUMN employee_invitations.token IS 'Secure random token used in invitation URL';
