-- Migration: Personalization Features
-- Adds feeling check-ins, personal preferences, and life events tracking

-- ============================================
-- FEELING CHECK-INS TABLE
-- ============================================
-- Track how users actually feel to learn their patterns
CREATE TABLE IF NOT EXISTS feeling_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Core feeling rating (1-5 scale)
    overall_feeling INTEGER NOT NULL CHECK (overall_feeling >= 1 AND overall_feeling <= 5),

    -- Optional detailed feelings
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
    stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 5),
    motivation_level INTEGER CHECK (motivation_level >= 1 AND motivation_level <= 5),

    -- Optional notes
    notes TEXT,

    -- Context at time of check-in (snapshot of recent metrics)
    context_snapshot JSONB,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feeling_checkins_employee ON feeling_checkins(employee_id, created_at DESC);

-- ============================================
-- PERSONAL PREFERENCES TABLE
-- ============================================
-- Individual settings for what's "normal" for each person
CREATE TABLE IF NOT EXISTS personal_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Sleep preferences
    ideal_sleep_hours DECIMAL(3,1) DEFAULT 7.5,
    sleep_flexibility VARCHAR(20) DEFAULT 'moderate' CHECK (sleep_flexibility IN ('rigid', 'moderate', 'flexible')),

    -- Chronotype (when they're most productive)
    chronotype VARCHAR(20) DEFAULT 'neutral' CHECK (chronotype IN ('early_bird', 'neutral', 'night_owl')),

    -- Work style
    ideal_work_hours DECIMAL(3,1) DEFAULT 8.0,
    preferred_work_pattern VARCHAR(30) DEFAULT 'steady' CHECK (preferred_work_pattern IN ('steady', 'burst', 'flexible')),
    max_meeting_hours_daily DECIMAL(3,1) DEFAULT 4.0,

    -- Social/energy preferences
    social_energy_type VARCHAR(20) DEFAULT 'ambivert' CHECK (social_energy_type IN ('introvert', 'ambivert', 'extrovert')),

    -- Exercise preferences
    ideal_exercise_minutes INTEGER DEFAULT 30,
    exercise_importance VARCHAR(20) DEFAULT 'moderate' CHECK (exercise_importance IN ('low', 'moderate', 'high')),

    -- Factor weights (how much each factor matters to THIS person, 0-100)
    weight_sleep INTEGER DEFAULT 50 CHECK (weight_sleep >= 0 AND weight_sleep <= 100),
    weight_exercise INTEGER DEFAULT 30 CHECK (weight_exercise >= 0 AND weight_exercise <= 100),
    weight_workload INTEGER DEFAULT 50 CHECK (weight_workload >= 0 AND weight_workload <= 100),
    weight_meetings INTEGER DEFAULT 40 CHECK (weight_meetings >= 0 AND weight_meetings <= 100),
    weight_heart_metrics INTEGER DEFAULT 30 CHECK (weight_heart_metrics >= 0 AND weight_heart_metrics <= 100),

    -- Onboarding completed
    setup_completed BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(employee_id)
);

-- ============================================
-- LIFE EVENTS TABLE
-- ============================================
-- Track temporary life circumstances that affect baselines
CREATE TABLE IF NOT EXISTS life_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Event type
    event_type VARCHAR(50) NOT NULL,
    event_label VARCHAR(100) NOT NULL,

    -- Duration
    start_date DATE NOT NULL,
    end_date DATE, -- NULL means ongoing

    -- Impact adjustments (percentage adjustments to expectations)
    sleep_adjustment INTEGER DEFAULT 0, -- e.g., -20 means expect 20% less sleep
    work_adjustment INTEGER DEFAULT 0,
    exercise_adjustment INTEGER DEFAULT 0,
    stress_tolerance_adjustment INTEGER DEFAULT 0,

    -- Notes
    notes TEXT,

    -- Is this event currently active?
    is_active BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_life_events_employee ON life_events(employee_id, is_active, start_date DESC);

-- ============================================
-- PREDEFINED LIFE EVENT TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS life_event_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL UNIQUE,
    event_label VARCHAR(100) NOT NULL,
    description TEXT,

    -- Default adjustments
    default_sleep_adjustment INTEGER DEFAULT 0,
    default_work_adjustment INTEGER DEFAULT 0,
    default_exercise_adjustment INTEGER DEFAULT 0,
    default_stress_tolerance_adjustment INTEGER DEFAULT 0,

    -- Suggested duration in days (NULL means user specifies)
    suggested_duration_days INTEGER,

    icon VARCHAR(50),
    category VARCHAR(50)
);

-- Insert common life event templates
INSERT INTO life_event_templates (event_type, event_label, description, default_sleep_adjustment, default_work_adjustment, default_exercise_adjustment, default_stress_tolerance_adjustment, suggested_duration_days, icon, category) VALUES
('new_baby', 'New Baby', 'Welcoming a new child to the family', -30, -20, -40, -30, 90, 'baby', 'family'),
('moving', 'Moving/Relocating', 'Moving to a new home or city', -20, -10, -30, -20, 30, 'home', 'life_change'),
('major_deadline', 'Major Deadline', 'Crunch time for an important project', -10, 20, -20, -20, 14, 'calendar', 'work'),
('health_issue', 'Health Issue', 'Dealing with a personal health matter', -20, -30, -50, -30, NULL, 'heart', 'health'),
('family_care', 'Caring for Family', 'Taking care of a family member', -20, -20, -30, -20, NULL, 'users', 'family'),
('bereavement', 'Loss/Bereavement', 'Grieving a loss', -30, -40, -40, -40, 30, 'heart', 'life_change'),
('wedding_planning', 'Wedding Planning', 'Preparing for a wedding', -10, 0, -10, -10, 60, 'ring', 'life_change'),
('new_job_role', 'New Job/Role', 'Starting a new position or responsibilities', -10, 10, 0, -15, 30, 'briefcase', 'work'),
('vacation_recovery', 'Post-Vacation', 'Readjusting after time off', -10, -10, -10, 0, 7, 'sun', 'recovery'),
('illness_recovery', 'Recovering from Illness', 'Getting back to normal after being sick', -20, -30, -40, -20, 14, 'thermometer', 'health')
ON CONFLICT (event_type) DO NOTHING;

-- ============================================
-- UPDATE SCORING ENGINE TO USE PREFERENCES
-- ============================================
-- Add a function to get personalized thresholds for an employee

COMMENT ON TABLE feeling_checkins IS 'Periodic mood/feeling check-ins to learn individual patterns';
COMMENT ON TABLE personal_preferences IS 'Individual preferences for ideal work/life balance settings';
COMMENT ON TABLE life_events IS 'Temporary life circumstances that affect expected baselines';
COMMENT ON TABLE life_event_templates IS 'Predefined templates for common life events with suggested adjustments';
