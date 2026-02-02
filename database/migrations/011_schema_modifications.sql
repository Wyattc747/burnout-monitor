-- Migration: B2B Schema Modifications
-- Modifies existing tables to support multi-tenancy

-- ============================================
-- USERS TABLE MODIFICATIONS
-- ============================================

-- Add organization reference
ALTER TABLE users
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add demo account flag
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_demo_account BOOLEAN DEFAULT false;

-- Update role check to include new roles
ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('super_admin', 'admin', 'manager', 'employee'));

-- Add index for organization lookups
CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);

-- ============================================
-- EMPLOYEES TABLE MODIFICATIONS
-- ============================================

-- Add organization reference
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add department reference
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Add HR external ID for synced employees
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS hr_external_id VARCHAR(255);

-- Add employment status
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50) DEFAULT 'active'
CHECK (employment_status IN ('pending', 'active', 'on_leave', 'terminated'));

-- Add explicit supervisor relationship (separate from manager_id which is team lead)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS reports_to_id UUID REFERENCES employees(id) ON DELETE SET NULL;

-- Add hierarchy level for org chart
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0;

-- Add onboarding status
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_employees_organization ON employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_hr_external ON employees(organization_id, hr_external_id);
CREATE INDEX IF NOT EXISTS idx_employees_reports_to ON employees(reports_to_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(employment_status);

-- ============================================
-- ADD FOREIGN KEYS TO DEPARTMENTS
-- ============================================
-- Now that employees table has organization_id, add the FK for department manager

-- First, add the FK constraint from departments to employees
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'departments_manager_employee_id_fkey'
    ) THEN
        ALTER TABLE departments
        ADD CONSTRAINT departments_manager_employee_id_fkey
        FOREIGN KEY (manager_employee_id) REFERENCES employees(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add FK from employee_invitations to employees for reports_to_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'employee_invitations_reports_to_id_fkey'
    ) THEN
        ALTER TABLE employee_invitations
        ADD CONSTRAINT employee_invitations_reports_to_id_fkey
        FOREIGN KEY (reports_to_id) REFERENCES employees(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add FK from employee_invitations to employees for employee_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'employee_invitations_employee_id_fkey'
    ) THEN
        ALTER TABLE employee_invitations
        ADD CONSTRAINT employee_invitations_employee_id_fkey
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- UPDATE EXISTING VIEWS
-- ============================================

-- Drop and recreate the view to include organization context
DROP VIEW IF EXISTS current_employee_status;

CREATE VIEW current_employee_status AS
SELECT
    e.id AS employee_id,
    e.organization_id,
    e.first_name,
    e.last_name,
    e.email,
    e.department_id,
    d.name AS department_name,
    e.job_title,
    e.employment_status,
    zh.zone,
    zh.burnout_score,
    zh.readiness_score,
    zh.explanation,
    zh.date AS status_date
FROM employees e
LEFT JOIN departments d ON e.department_id = d.id
LEFT JOIN LATERAL (
    SELECT * FROM zone_history
    WHERE employee_id = e.id
    ORDER BY date DESC
    LIMIT 1
) zh ON true
WHERE e.is_active = true AND e.employment_status = 'active';

-- Update alert summary view to include organization context
DROP VIEW IF EXISTS alert_summary;

CREATE VIEW alert_summary AS
SELECT
    a.id,
    a.employee_id,
    e.organization_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.department_id,
    d.name AS department_name,
    a.type,
    a.zone,
    a.title,
    a.message,
    a.is_acknowledged,
    a.created_at
FROM alerts a
JOIN employees e ON a.employee_id = e.id
LEFT JOIN departments d ON e.department_id = d.id
WHERE a.is_acknowledged = false
ORDER BY a.created_at DESC;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to compute department hierarchy level
CREATE OR REPLACE FUNCTION compute_department_hierarchy()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.parent_department_id IS NULL THEN
        NEW.hierarchy_level := 0;
        NEW.hierarchy_path := '/' || NEW.id::text;
    ELSE
        SELECT
            hierarchy_level + 1,
            hierarchy_path || '/' || NEW.id::text
        INTO NEW.hierarchy_level, NEW.hierarchy_path
        FROM departments
        WHERE id = NEW.parent_department_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic hierarchy computation
DROP TRIGGER IF EXISTS trigger_compute_department_hierarchy ON departments;
CREATE TRIGGER trigger_compute_department_hierarchy
BEFORE INSERT OR UPDATE OF parent_department_id ON departments
FOR EACH ROW
EXECUTE FUNCTION compute_department_hierarchy();

-- Function to compute employee hierarchy level based on reports_to chain
CREATE OR REPLACE FUNCTION compute_employee_hierarchy_level(emp_id UUID)
RETURNS INTEGER AS $$
DECLARE
    level INTEGER := 0;
    current_id UUID := emp_id;
BEGIN
    LOOP
        SELECT reports_to_id INTO current_id
        FROM employees
        WHERE id = current_id;

        EXIT WHEN current_id IS NULL;
        level := level + 1;

        -- Safety limit to prevent infinite loops
        IF level > 50 THEN
            EXIT;
        END IF;
    END LOOP;
    RETURN level;
END;
$$ LANGUAGE plpgsql;

-- Function to get all descendants of a department
CREATE OR REPLACE FUNCTION get_department_descendants(dept_id UUID)
RETURNS TABLE(department_id UUID, name VARCHAR, hierarchy_level INTEGER) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE dept_tree AS (
        SELECT d.id, d.name, d.hierarchy_level, d.parent_department_id
        FROM departments d
        WHERE d.id = dept_id

        UNION ALL

        SELECT d.id, d.name, d.hierarchy_level, d.parent_department_id
        FROM departments d
        INNER JOIN dept_tree dt ON d.parent_department_id = dt.id
    )
    SELECT dt.id, dt.name, dt.hierarchy_level
    FROM dept_tree dt
    WHERE dt.id != dept_id;  -- Exclude the starting department
END;
$$ LANGUAGE plpgsql;

-- Function to get all employees in a department and its descendants
CREATE OR REPLACE FUNCTION get_department_employees(dept_id UUID, include_descendants BOOLEAN DEFAULT true)
RETURNS TABLE(employee_id UUID) AS $$
BEGIN
    IF include_descendants THEN
        RETURN QUERY
        SELECT e.id
        FROM employees e
        WHERE e.department_id = dept_id
           OR e.department_id IN (
               SELECT department_id FROM get_department_descendants(dept_id)
           );
    ELSE
        RETURN QUERY
        SELECT e.id FROM employees e WHERE e.department_id = dept_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN users.organization_id IS 'Organization this user belongs to (multi-tenancy)';
COMMENT ON COLUMN users.is_demo_account IS 'Flag for demo accounts that bypass organization setup';
COMMENT ON COLUMN employees.organization_id IS 'Organization this employee belongs to (multi-tenancy)';
COMMENT ON COLUMN employees.department_id IS 'Department this employee belongs to';
COMMENT ON COLUMN employees.hr_external_id IS 'External ID from HR system for synced employees';
COMMENT ON COLUMN employees.employment_status IS 'Current employment status';
COMMENT ON COLUMN employees.reports_to_id IS 'Direct supervisor (separate from team manager_id)';
COMMENT ON COLUMN employees.hierarchy_level IS 'Position in org hierarchy (0 = top)';
COMMENT ON FUNCTION compute_department_hierarchy IS 'Automatically computes hierarchy_level and hierarchy_path for departments';
COMMENT ON FUNCTION get_department_descendants IS 'Returns all child departments recursively';
COMMENT ON FUNCTION get_department_employees IS 'Returns all employees in a department (optionally including descendants)';
