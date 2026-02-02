-- Migration: Demo Organization Setup
-- Creates the demo organization and migrates existing data

-- ============================================
-- CREATE DEMO ORGANIZATION
-- ============================================

-- Insert the demo organization
INSERT INTO organizations (
    id,
    name,
    slug,
    domain,
    subscription_tier,
    subscription_status,
    max_employees,
    settings,
    industry,
    company_size
) VALUES (
    '00000000-0000-0000-0000-000000000001',  -- Fixed UUID for demo org
    'ShepHerd Demo',
    'demo',
    NULL,  -- No domain restriction for demo
    'enterprise',  -- Full features for demo
    'active',
    1000,  -- High limit for demo
    '{"is_demo": true, "demo_features_enabled": true}'::jsonb,
    'Technology',
    '51-200'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    subscription_tier = EXCLUDED.subscription_tier,
    max_employees = EXCLUDED.max_employees,
    settings = EXCLUDED.settings;

-- ============================================
-- CREATE DEMO DEPARTMENT
-- ============================================

INSERT INTO departments (
    id,
    organization_id,
    name,
    code,
    description,
    hierarchy_level,
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000002',  -- Fixed UUID for demo dept
    '00000000-0000-0000-0000-000000000001',  -- Demo org
    'Demo Company',
    'DEMO',
    'Default department for demo accounts',
    0,
    true
) ON CONFLICT (organization_id, name, parent_department_id) DO NOTHING;

-- ============================================
-- MIGRATE EXISTING USERS TO DEMO ORG
-- ============================================

-- Update all existing users to belong to demo organization
UPDATE users
SET
    organization_id = '00000000-0000-0000-0000-000000000001',
    is_demo_account = true
WHERE organization_id IS NULL;

-- ============================================
-- MIGRATE EXISTING EMPLOYEES TO DEMO ORG
-- ============================================

-- Update all existing employees to belong to demo organization
UPDATE employees
SET
    organization_id = '00000000-0000-0000-0000-000000000001',
    department_id = '00000000-0000-0000-0000-000000000002',
    employment_status = 'active'
WHERE organization_id IS NULL;

-- ============================================
-- SET REPORTS_TO BASED ON EXISTING MANAGER_ID
-- ============================================

-- Copy manager_id to reports_to_id for existing employees
UPDATE employees
SET reports_to_id = manager_id
WHERE manager_id IS NOT NULL
  AND reports_to_id IS NULL
  AND organization_id = '00000000-0000-0000-0000-000000000001';

-- ============================================
-- COMPUTE HIERARCHY LEVELS FOR EXISTING EMPLOYEES
-- ============================================

-- Update hierarchy levels using the helper function
UPDATE employees
SET hierarchy_level = compute_employee_hierarchy_level(id)
WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- ============================================
-- UPDATE EXISTING MANAGERS TO HAVE MANAGER ROLE
-- ============================================

-- Set users who have employees reporting to them as managers
UPDATE users u
SET role = 'manager'
WHERE EXISTS (
    SELECT 1 FROM employees e
    WHERE e.user_id = u.id
    AND EXISTS (
        SELECT 1 FROM employees e2 WHERE e2.reports_to_id = e.id
    )
)
AND u.role = 'employee';

-- ============================================
-- VERIFY MIGRATION
-- ============================================

-- Log migration statistics (this will be visible in psql output)
DO $$
DECLARE
    user_count INTEGER;
    employee_count INTEGER;
    org_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users WHERE organization_id = '00000000-0000-0000-0000-000000000001';
    SELECT COUNT(*) INTO employee_count FROM employees WHERE organization_id = '00000000-0000-0000-0000-000000000001';
    SELECT COUNT(*) INTO org_count FROM organizations;

    RAISE NOTICE 'Demo organization migration complete:';
    RAISE NOTICE '  - Organizations: %', org_count;
    RAISE NOTICE '  - Users migrated to demo org: %', user_count;
    RAISE NOTICE '  - Employees migrated to demo org: %', employee_count;
END $$;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE organizations IS 'Demo organization (id: 00000000-0000-0000-0000-000000000001) contains all existing users';
