-- Burnout Monitor Database Schema
-- PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('manager', 'employee')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- EMPLOYEES TABLE
-- ============================================
-- Links to user account if employee has login, otherwise standalone
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    department VARCHAR(100),
    job_title VARCHAR(100),
    hire_date DATE,
    manager_id UUID REFERENCES employees(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_manager_id ON employees(manager_id);

-- ============================================
-- HEALTH METRICS TABLE
-- ============================================
-- Daily health data from Apple Watch (or synthetic)
CREATE TABLE health_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Heart metrics
    resting_heart_rate INTEGER,          -- bpm
    avg_heart_rate INTEGER,              -- bpm
    max_heart_rate INTEGER,              -- bpm
    heart_rate_variability DECIMAL(5,2), -- ms (HRV)

    -- Sleep metrics
    sleep_hours DECIMAL(4,2),            -- hours
    sleep_quality_score INTEGER,         -- 0-100
    deep_sleep_hours DECIMAL(4,2),
    rem_sleep_hours DECIMAL(4,2),
    sleep_start_time TIME,
    sleep_end_time TIME,

    -- Activity metrics
    steps INTEGER,
    active_calories INTEGER,
    exercise_minutes INTEGER,
    standing_hours INTEGER,

    -- Stress indicators
    stress_level INTEGER,                -- 0-100 (if available)
    recovery_score INTEGER,              -- 0-100 (if available)

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(employee_id, date)
);

CREATE INDEX idx_health_metrics_employee_date ON health_metrics(employee_id, date DESC);

-- ============================================
-- WORK METRICS TABLE
-- ============================================
-- Daily work data
CREATE TABLE work_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Time metrics
    hours_worked DECIMAL(4,2),           -- hours
    overtime_hours DECIMAL(4,2),
    break_minutes INTEGER,
    first_login_time TIME,
    last_logout_time TIME,

    -- Productivity metrics
    tasks_completed INTEGER,
    tasks_assigned INTEGER,
    meetings_attended INTEGER,
    meeting_hours DECIMAL(4,2),

    -- Communication metrics
    emails_sent INTEGER,
    emails_received INTEGER,
    avg_response_time_minutes INTEGER,   -- email response time
    messages_sent INTEGER,               -- Slack/Teams

    -- Quality metrics (optional)
    focus_time_hours DECIMAL(4,2),       -- Deep work time
    context_switches INTEGER,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(employee_id, date)
);

CREATE INDEX idx_work_metrics_employee_date ON work_metrics(employee_id, date DESC);

-- ============================================
-- ZONE HISTORY TABLE
-- ============================================
-- Track zone status over time
CREATE TABLE zone_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Calculated scores
    burnout_score DECIMAL(5,2) NOT NULL,     -- 0-100
    readiness_score DECIMAL(5,2) NOT NULL,   -- 0-100

    -- Zone classification
    zone VARCHAR(10) NOT NULL CHECK (zone IN ('red', 'yellow', 'green')),
    previous_zone VARCHAR(10),
    zone_changed BOOLEAN DEFAULT false,

    -- Explanation data (JSON for flexibility)
    explanation JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(employee_id, date)
);

CREATE INDEX idx_zone_history_employee_date ON zone_history(employee_id, date DESC);
CREATE INDEX idx_zone_history_zone ON zone_history(zone);

-- ============================================
-- ALERTS TABLE
-- ============================================
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Alert details
    type VARCHAR(20) NOT NULL CHECK (type IN ('burnout', 'opportunity')),
    zone VARCHAR(10) NOT NULL CHECK (zone IN ('red', 'green')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Status
    is_read BOOLEAN DEFAULT false,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,

    -- Notification tracking
    sms_sent BOOLEAN DEFAULT false,
    sms_sent_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_employee_id ON alerts(employee_id);
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
CREATE INDEX idx_alerts_unacknowledged ON alerts(is_acknowledged) WHERE is_acknowledged = false;

-- ============================================
-- SMS LOGS TABLE
-- ============================================
CREATE TABLE sms_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES alerts(id) ON DELETE SET NULL,

    -- Recipient info
    phone_number VARCHAR(20) NOT NULL,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('manager', 'employee')),
    recipient_user_id UUID REFERENCES users(id),

    -- Message details
    message_body TEXT NOT NULL,

    -- Twilio response
    twilio_sid VARCHAR(50),
    status VARCHAR(20),                   -- sent, delivered, failed
    error_message TEXT,

    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sms_logs_alert_id ON sms_logs(alert_id);
CREATE INDEX idx_sms_logs_sent_at ON sms_logs(sent_at DESC);

-- ============================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- SMS preferences
    sms_enabled BOOLEAN DEFAULT true,
    sms_phone_number VARCHAR(20),
    sms_on_burnout BOOLEAN DEFAULT true,
    sms_on_opportunity BOOLEAN DEFAULT true,

    -- Email preferences (for future use)
    email_enabled BOOLEAN DEFAULT true,
    email_on_burnout BOOLEAN DEFAULT true,
    email_on_opportunity BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id)
);

-- ============================================
-- EMPLOYEE BASELINES TABLE
-- ============================================
-- Store calculated baselines for comparison
CREATE TABLE employee_baselines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Health baselines (rolling averages)
    baseline_resting_hr DECIMAL(5,2),
    baseline_hrv DECIMAL(5,2),
    baseline_sleep_hours DECIMAL(4,2),
    baseline_sleep_quality DECIMAL(5,2),
    baseline_steps INTEGER,

    -- Work baselines
    baseline_hours_worked DECIMAL(4,2),
    baseline_tasks_completed DECIMAL(5,2),
    baseline_response_time INTEGER,

    -- Calculation metadata
    calculation_period_days INTEGER DEFAULT 14,
    last_calculated_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(employee_id)
);

-- ============================================
-- DEMO STATE TABLE
-- ============================================
-- For demo mode time simulation
CREATE TABLE demo_state (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Singleton
    is_active BOOLEAN DEFAULT false,
    virtual_time TIMESTAMP WITH TIME ZONE,
    original_state_snapshot JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default demo state
INSERT INTO demo_state (id, is_active) VALUES (1, false);

-- ============================================
-- HELPER VIEWS
-- ============================================

-- Current zone status for all employees
CREATE VIEW current_employee_status AS
SELECT
    e.id AS employee_id,
    e.first_name,
    e.last_name,
    e.email,
    e.department,
    zh.zone,
    zh.burnout_score,
    zh.readiness_score,
    zh.explanation,
    zh.date AS status_date
FROM employees e
LEFT JOIN LATERAL (
    SELECT * FROM zone_history
    WHERE employee_id = e.id
    ORDER BY date DESC
    LIMIT 1
) zh ON true
WHERE e.is_active = true;

-- Alert summary for dashboard
CREATE VIEW alert_summary AS
SELECT
    a.id,
    a.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    a.type,
    a.zone,
    a.title,
    a.message,
    a.is_acknowledged,
    a.created_at
FROM alerts a
JOIN employees e ON a.employee_id = e.id
WHERE a.is_acknowledged = false
ORDER BY a.created_at DESC;
