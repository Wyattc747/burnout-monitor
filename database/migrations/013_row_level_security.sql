-- Migration: Row Level Security for Multi-Tenancy
-- Implements tenant isolation using PostgreSQL RLS

-- ============================================
-- ENABLE RLS ON CORE TABLES
-- ============================================

-- Organizations (self-access only)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Departments
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- HR Integrations
ALTER TABLE hr_integrations ENABLE ROW LEVEL SECURITY;

-- HR Sync Logs
ALTER TABLE hr_sync_logs ENABLE ROW LEVEL SECURITY;

-- Employee Invitations
ALTER TABLE employee_invitations ENABLE ROW LEVEL SECURITY;

-- Organization Audit Logs
ALTER TABLE organization_audit_logs ENABLE ROW LEVEL SECURITY;

-- Alerts
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Health Metrics
ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;

-- Work Metrics
ALTER TABLE work_metrics ENABLE ROW LEVEL SECURITY;

-- Zone History
ALTER TABLE zone_history ENABLE ROW LEVEL SECURITY;

-- Employee Baselines
ALTER TABLE employee_baselines ENABLE ROW LEVEL SECURITY;

-- Notification Preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Challenges
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

-- Challenge Participants
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;

-- Feeling Checkins
ALTER TABLE feeling_checkins ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS HELPER FUNCTION
-- ============================================

-- Get current organization ID from session variable
CREATE OR REPLACE FUNCTION current_org_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_organization_id', true), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get current user ID from session variable
CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get current user role from session variable
CREATE OR REPLACE FUNCTION current_app_user_role()
RETURNS VARCHAR AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_role', true), '');
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if current user is admin (super_admin or admin)
CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN current_app_user_role() IN ('super_admin', 'admin');
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- ORGANIZATIONS POLICIES
-- ============================================

-- Users can only see their own organization
DROP POLICY IF EXISTS organizations_tenant_isolation ON organizations;
CREATE POLICY organizations_tenant_isolation ON organizations
    FOR ALL
    USING (id = current_org_id());

-- ============================================
-- USERS POLICIES
-- ============================================

-- Users can only see users in their organization
DROP POLICY IF EXISTS users_tenant_isolation ON users;
CREATE POLICY users_tenant_isolation ON users
    FOR ALL
    USING (organization_id = current_org_id());

-- ============================================
-- EMPLOYEES POLICIES
-- ============================================

-- Employees can only see employees in their organization
DROP POLICY IF EXISTS employees_tenant_isolation ON employees;
CREATE POLICY employees_tenant_isolation ON employees
    FOR ALL
    USING (organization_id = current_org_id());

-- ============================================
-- DEPARTMENTS POLICIES
-- ============================================

DROP POLICY IF EXISTS departments_tenant_isolation ON departments;
CREATE POLICY departments_tenant_isolation ON departments
    FOR ALL
    USING (organization_id = current_org_id());

-- ============================================
-- HR INTEGRATIONS POLICIES
-- ============================================

DROP POLICY IF EXISTS hr_integrations_tenant_isolation ON hr_integrations;
CREATE POLICY hr_integrations_tenant_isolation ON hr_integrations
    FOR ALL
    USING (organization_id = current_org_id());

-- ============================================
-- HR SYNC LOGS POLICIES
-- ============================================

DROP POLICY IF EXISTS hr_sync_logs_tenant_isolation ON hr_sync_logs;
CREATE POLICY hr_sync_logs_tenant_isolation ON hr_sync_logs
    FOR ALL
    USING (
        hr_integration_id IN (
            SELECT id FROM hr_integrations WHERE organization_id = current_org_id()
        )
    );

-- ============================================
-- EMPLOYEE INVITATIONS POLICIES
-- ============================================

DROP POLICY IF EXISTS invitations_tenant_isolation ON employee_invitations;
CREATE POLICY invitations_tenant_isolation ON employee_invitations
    FOR ALL
    USING (organization_id = current_org_id());

-- ============================================
-- AUDIT LOGS POLICIES
-- ============================================

DROP POLICY IF EXISTS audit_logs_tenant_isolation ON organization_audit_logs;
CREATE POLICY audit_logs_tenant_isolation ON organization_audit_logs
    FOR ALL
    USING (organization_id = current_org_id());

-- ============================================
-- ALERTS POLICIES
-- ============================================

DROP POLICY IF EXISTS alerts_tenant_isolation ON alerts;
CREATE POLICY alerts_tenant_isolation ON alerts
    FOR ALL
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE organization_id = current_org_id()
        )
    );

-- ============================================
-- HEALTH METRICS POLICIES
-- ============================================

DROP POLICY IF EXISTS health_metrics_tenant_isolation ON health_metrics;
CREATE POLICY health_metrics_tenant_isolation ON health_metrics
    FOR ALL
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE organization_id = current_org_id()
        )
    );

-- ============================================
-- WORK METRICS POLICIES
-- ============================================

DROP POLICY IF EXISTS work_metrics_tenant_isolation ON work_metrics;
CREATE POLICY work_metrics_tenant_isolation ON work_metrics
    FOR ALL
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE organization_id = current_org_id()
        )
    );

-- ============================================
-- ZONE HISTORY POLICIES
-- ============================================

DROP POLICY IF EXISTS zone_history_tenant_isolation ON zone_history;
CREATE POLICY zone_history_tenant_isolation ON zone_history
    FOR ALL
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE organization_id = current_org_id()
        )
    );

-- ============================================
-- EMPLOYEE BASELINES POLICIES
-- ============================================

DROP POLICY IF EXISTS baselines_tenant_isolation ON employee_baselines;
CREATE POLICY baselines_tenant_isolation ON employee_baselines
    FOR ALL
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE organization_id = current_org_id()
        )
    );

-- ============================================
-- NOTIFICATION PREFERENCES POLICIES
-- ============================================

DROP POLICY IF EXISTS notifications_tenant_isolation ON notification_preferences;
CREATE POLICY notifications_tenant_isolation ON notification_preferences
    FOR ALL
    USING (
        user_id IN (
            SELECT id FROM users WHERE organization_id = current_org_id()
        )
    );

-- ============================================
-- CHALLENGES POLICIES
-- ============================================

DROP POLICY IF EXISTS challenges_tenant_isolation ON challenges;
CREATE POLICY challenges_tenant_isolation ON challenges
    FOR ALL
    USING (
        created_by IN (
            SELECT id FROM employees WHERE organization_id = current_org_id()
        )
    );

-- ============================================
-- CHALLENGE PARTICIPANTS POLICIES
-- ============================================

DROP POLICY IF EXISTS participants_tenant_isolation ON challenge_participants;
CREATE POLICY participants_tenant_isolation ON challenge_participants
    FOR ALL
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE organization_id = current_org_id()
        )
    );

-- ============================================
-- FEELING CHECKINS POLICIES
-- ============================================

DROP POLICY IF EXISTS checkins_tenant_isolation ON feeling_checkins;
CREATE POLICY checkins_tenant_isolation ON feeling_checkins
    FOR ALL
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE organization_id = current_org_id()
        )
    );

-- ============================================
-- BYPASS POLICIES FOR SERVICE ROLE
-- ============================================

-- Create a service role that bypasses RLS (for background jobs, migrations, etc.)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'burnout_service') THEN
        CREATE ROLE burnout_service;
    END IF;
END $$;

-- Grant service role bypass on all tables
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;
ALTER TABLE hr_integrations FORCE ROW LEVEL SECURITY;
ALTER TABLE hr_sync_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE employee_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE health_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE work_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE zone_history FORCE ROW LEVEL SECURITY;
ALTER TABLE employee_baselines FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE challenges FORCE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants FORCE ROW LEVEL SECURITY;
ALTER TABLE feeling_checkins FORCE ROW LEVEL SECURITY;

-- Create bypass policies for service role
CREATE POLICY service_bypass ON organizations FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON users FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON employees FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON departments FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON hr_integrations FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON hr_sync_logs FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON employee_invitations FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON organization_audit_logs FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON alerts FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON health_metrics FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON work_metrics FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON zone_history FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON employee_baselines FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON notification_preferences FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON challenges FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON challenge_participants FOR ALL TO burnout_service USING (true);
CREATE POLICY service_bypass ON feeling_checkins FOR ALL TO burnout_service USING (true);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON FUNCTION current_org_id() IS 'Returns the current organization ID from session variable app.current_organization_id';
COMMENT ON FUNCTION current_app_user_id() IS 'Returns the current user ID from session variable app.current_user_id';
COMMENT ON FUNCTION current_app_user_role() IS 'Returns the current user role from session variable app.current_user_role';
COMMENT ON FUNCTION is_org_admin() IS 'Returns true if current user is super_admin or admin';
