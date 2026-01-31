-- Migration: Configurable Thresholds & Enhanced Scoring
-- Adds configurable thresholds, scoring consent, and validated instruments

-- ============================================
-- ORGANIZATION THRESHOLDS
-- ============================================
-- System/organization-level default thresholds
CREATE TABLE IF NOT EXISTS organization_thresholds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID,  -- NULL means system default
    burnout_red_threshold INTEGER DEFAULT 70,
    readiness_green_threshold INTEGER DEFAULT 70,
    threshold_type VARCHAR(20) DEFAULT 'absolute' CHECK (threshold_type IN ('absolute', 'percentile')),
    interaction_high_threshold INTEGER DEFAULT 50,
    interaction_critical_threshold INTEGER DEFAULT 70,
    enable_interaction_effects BOOLEAN DEFAULT true,
    weekend_adjustment_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id)
);

-- Insert system defaults
INSERT INTO organization_thresholds (organization_id, burnout_red_threshold, readiness_green_threshold)
VALUES (NULL, 70, 70)
ON CONFLICT DO NOTHING;

-- ============================================
-- EMPLOYEE THRESHOLD OVERRIDES
-- ============================================
-- Individual employee threshold overrides (temporary or permanent)
CREATE TABLE IF NOT EXISTS employee_threshold_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    burnout_red_threshold INTEGER,
    readiness_green_threshold INTEGER,
    interaction_high_threshold INTEGER,
    override_reason TEXT,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,  -- NULL means permanent
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employee_threshold_overrides_employee ON employee_threshold_overrides(employee_id);
CREATE INDEX idx_employee_threshold_overrides_dates ON employee_threshold_overrides(employee_id, start_date, end_date);

-- ============================================
-- SCORING CONSENT
-- ============================================
-- Employee consent for data usage in scoring
CREATE TABLE IF NOT EXISTS scoring_consent (
    employee_id UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
    use_health_data BOOLEAN DEFAULT true,
    use_work_data BOOLEAN DEFAULT true,
    use_checkin_data BOOLEAN DEFAULT true,
    allow_aggregate_contribution BOOLEAN DEFAULT true,
    consent_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- BURNOUT INSTRUMENT QUESTIONS
-- ============================================
-- Validated self-report instrument questions (e.g., MBI-GS exhaustion subscale)
CREATE TABLE IF NOT EXISTS burnout_instrument_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instrument_type VARCHAR(50) NOT NULL,  -- 'mbi_exhaustion', 'quick', 'custom'
    question_text TEXT NOT NULL,
    question_order INTEGER NOT NULL,
    scale_min INTEGER DEFAULT 1,
    scale_max INTEGER DEFAULT 5,
    weight DECIMAL(3,2) DEFAULT 1.0,
    reverse_scored BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_burnout_instrument_questions_type ON burnout_instrument_questions(instrument_type, is_active);

-- Insert quick burnout assessment questions
INSERT INTO burnout_instrument_questions (instrument_type, question_text, question_order, scale_min, scale_max, weight) VALUES
('quick', 'I feel emotionally drained from my work', 1, 1, 5, 1.0),
('quick', 'I feel used up at the end of the workday', 2, 1, 5, 1.0),
('quick', 'I feel fatigued when I get up in the morning and have to face another day on the job', 3, 1, 5, 1.0),
('quick', 'Working all day is really a strain for me', 4, 1, 5, 0.8),
('quick', 'I feel burned out from my work', 5, 1, 5, 1.2)
ON CONFLICT DO NOTHING;

-- ============================================
-- FEELING CHECKINS ENHANCEMENTS
-- ============================================
-- Add validated responses column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'feeling_checkins' AND column_name = 'validated_responses'
    ) THEN
        ALTER TABLE feeling_checkins ADD COLUMN validated_responses JSONB;
    END IF;
END $$;

-- Add burnout_score_at_checkin column to track algorithmic score at check-in time
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'feeling_checkins' AND column_name = 'burnout_score_at_checkin'
    ) THEN
        ALTER TABLE feeling_checkins ADD COLUMN burnout_score_at_checkin DECIMAL(5,2);
    END IF;
END $$;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE organization_thresholds IS 'System and organization-level default thresholds for scoring';
COMMENT ON TABLE employee_threshold_overrides IS 'Individual employee threshold overrides with optional date ranges';
COMMENT ON TABLE scoring_consent IS 'Employee consent settings for data usage in scoring and aggregation';
COMMENT ON TABLE burnout_instrument_questions IS 'Validated self-report instrument questions for burnout assessment';
COMMENT ON COLUMN feeling_checkins.validated_responses IS 'Responses to validated instrument questions during check-in';
COMMENT ON COLUMN feeling_checkins.burnout_score_at_checkin IS 'Algorithmic burnout score at the time of check-in for calibration';
