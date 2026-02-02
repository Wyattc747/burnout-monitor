-- Migration: Add demo wellness data for admin employee
-- Adds health metrics, work metrics, feeling check-ins, and goals for the admin@demo.com user

-- Admin Employee ID: 9ae839c7-d059-4087-bca9-315d5b5bd19c

-- ============================================
-- CREATE GOALS TABLE (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    goal_type VARCHAR(50) NOT NULL CHECK (goal_type IN ('sleep', 'exercise', 'green_zone', 'checkin_streak', 'steps', 'focus')),
    target_value NUMERIC(10,2) NOT NULL,
    current_value NUMERIC(10,2) DEFAULT 0,
    deadline DATE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_goals_employee ON goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(employee_id, status);

-- ============================================
-- HEALTH METRICS (Last 30 days - Good health)
-- ============================================

INSERT INTO health_metrics (
    employee_id, date, resting_heart_rate, avg_heart_rate, max_heart_rate,
    heart_rate_variability, sleep_hours, sleep_quality_score, deep_sleep_hours,
    rem_sleep_hours, steps, active_calories, exercise_minutes, standing_hours, source
)
SELECT
    '9ae839c7-d059-4087-bca9-315d5b5bd19c'::uuid,
    (CURRENT_DATE - (n || ' days')::interval)::date,
    -- Good resting heart rate (55-65)
    55 + floor(random() * 10)::int,
    -- Good avg heart rate (65-80)
    65 + floor(random() * 15)::int,
    -- Max heart rate during exercise (140-165)
    140 + floor(random() * 25)::int,
    -- Good HRV (45-65)
    45 + (random() * 20)::numeric(5,2),
    -- Good sleep (7-8.5 hours)
    7.0 + (random() * 1.5)::numeric(4,2),
    -- Good sleep quality (75-95)
    75 + floor(random() * 20)::int,
    -- Deep sleep (1.5-2.5 hours)
    1.5 + (random() * 1.0)::numeric(4,2),
    -- REM sleep (1.5-2.5 hours)
    1.5 + (random() * 1.0)::numeric(4,2),
    -- Good steps (8000-12000)
    8000 + floor(random() * 4000)::int,
    -- Active calories (400-600)
    400 + floor(random() * 200)::int,
    -- Exercise minutes (30-60)
    30 + floor(random() * 30)::int,
    -- Standing hours (8-12)
    8 + floor(random() * 4)::int,
    'synthetic'
FROM generate_series(0, 29) AS n
ON CONFLICT (employee_id, date) DO NOTHING;

-- ============================================
-- WORK METRICS (Last 30 days - Balanced workload)
-- ============================================

INSERT INTO work_metrics (
    employee_id, date, hours_worked, overtime_hours, break_minutes,
    first_login_time, last_logout_time, tasks_completed, tasks_assigned,
    meetings_attended, meeting_hours, emails_sent, emails_received,
    avg_response_time_minutes, messages_sent, focus_time_hours, context_switches, source
)
SELECT
    '9ae839c7-d059-4087-bca9-315d5b5bd19c'::uuid,
    (CURRENT_DATE - (n || ' days')::interval)::date,
    -- Reasonable hours worked (7.5-9)
    7.5 + (random() * 1.5)::numeric(4,2),
    -- Minimal overtime (0-1)
    (random() * 1.0)::numeric(4,2),
    -- Good break time (45-75 minutes)
    45 + floor(random() * 30)::int,
    -- Start time
    '08:30:00'::time,
    -- End time
    '17:30:00'::time,
    -- Tasks completed (5-10)
    5 + floor(random() * 5)::int,
    -- Tasks assigned (6-12)
    6 + floor(random() * 6)::int,
    -- Meetings (3-6 per day)
    3 + floor(random() * 3)::int,
    -- Meeting hours (2-4)
    2.0 + (random() * 2.0)::numeric(4,2),
    -- Emails sent (15-35)
    15 + floor(random() * 20)::int,
    -- Emails received (30-60)
    30 + floor(random() * 30)::int,
    -- Response time (15-45 mins)
    15 + floor(random() * 30)::int,
    -- Messages (20-50)
    20 + floor(random() * 30)::int,
    -- Focus time (3-5 hours)
    3.0 + (random() * 2.0)::numeric(4,2),
    -- Context switches (8-15)
    8 + floor(random() * 7)::int,
    'synthetic'
FROM generate_series(0, 29) AS n
ON CONFLICT (employee_id, date) DO NOTHING;

-- ============================================
-- FEELING CHECK-INS (Recent check-ins)
-- overall_feeling is 1-5 (1=terrible, 5=great)
-- ============================================

INSERT INTO feeling_checkins (employee_id, overall_feeling, energy_level, stress_level, motivation_level, notes, created_at)
VALUES
    ('9ae839c7-d059-4087-bca9-315d5b5bd19c', 4, 4, 2, 4, 'Feeling productive today!', CURRENT_TIMESTAMP),
    ('9ae839c7-d059-4087-bca9-315d5b5bd19c', 5, 5, 1, 5, 'Had a great workout this morning', CURRENT_TIMESTAMP - interval '1 day'),
    ('9ae839c7-d059-4087-bca9-315d5b5bd19c', 4, 4, 2, 4, 'Steady day', CURRENT_TIMESTAMP - interval '2 days'),
    ('9ae839c7-d059-4087-bca9-315d5b5bd19c', 3, 3, 3, 3, 'Bit tired but managing', CURRENT_TIMESTAMP - interval '3 days'),
    ('9ae839c7-d059-4087-bca9-315d5b5bd19c', 4, 4, 2, 4, NULL, CURRENT_TIMESTAMP - interval '4 days'),
    ('9ae839c7-d059-4087-bca9-315d5b5bd19c', 5, 5, 1, 5, 'Feeling energized', CURRENT_TIMESTAMP - interval '5 days'),
    ('9ae839c7-d059-4087-bca9-315d5b5bd19c', 4, 4, 2, 4, NULL, CURRENT_TIMESTAMP - interval '6 days')
ON CONFLICT DO NOTHING;

-- ============================================
-- GOALS (Active wellness goals)
-- ============================================

INSERT INTO goals (employee_id, goal_type, target_value, current_value, deadline, status)
VALUES
    ('9ae839c7-d059-4087-bca9-315d5b5bd19c', 'sleep', 7.5, 7.8, CURRENT_DATE + 30, 'active'),
    ('9ae839c7-d059-4087-bca9-315d5b5bd19c', 'steps', 10000, 9500, CURRENT_DATE + 30, 'active'),
    ('9ae839c7-d059-4087-bca9-315d5b5bd19c', 'exercise', 45, 42, CURRENT_DATE + 30, 'active')
ON CONFLICT DO NOTHING;

-- ============================================
-- UPDATE EMPLOYEE RECORD
-- ============================================

UPDATE employees
SET
    first_name = 'Demo',
    last_name = 'Admin',
    job_title = 'Platform Administrator',
    department = 'Executive',
    onboarding_completed = true
WHERE id = '9ae839c7-d059-4087-bca9-315d5b5bd19c';

-- ============================================
-- VERIFY DATA
-- ============================================

DO $$
DECLARE
    health_count INTEGER;
    work_count INTEGER;
    checkin_count INTEGER;
    goal_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO health_count FROM health_metrics WHERE employee_id = '9ae839c7-d059-4087-bca9-315d5b5bd19c';
    SELECT COUNT(*) INTO work_count FROM work_metrics WHERE employee_id = '9ae839c7-d059-4087-bca9-315d5b5bd19c';
    SELECT COUNT(*) INTO checkin_count FROM feeling_checkins WHERE employee_id = '9ae839c7-d059-4087-bca9-315d5b5bd19c';
    SELECT COUNT(*) INTO goal_count FROM goals WHERE employee_id = '9ae839c7-d059-4087-bca9-315d5b5bd19c';

    RAISE NOTICE 'Admin demo data created:';
    RAISE NOTICE '  - Health metrics: %', health_count;
    RAISE NOTICE '  - Work metrics: %', work_count;
    RAISE NOTICE '  - Feeling check-ins: %', checkin_count;
    RAISE NOTICE '  - Goals: %', goal_count;
END $$;
