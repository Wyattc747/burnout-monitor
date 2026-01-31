-- Migration: Enhanced Features
-- Adds team management, Gmail integration, privacy settings, wellness features

-- ============================================
-- TEAM MANAGEMENT
-- ============================================
-- Managers can have multiple employees, employees can have one manager
ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES employees(id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);

-- Team invitations for adding employees
CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inviter_id UUID NOT NULL REFERENCES users(id),
    email VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_team_invitations_email ON team_invitations(email, status);
CREATE INDEX idx_team_invitations_token ON team_invitations(token);

-- ============================================
-- GMAIL INTEGRATION
-- ============================================
CREATE TABLE IF NOT EXISTS gmail_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE,
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Email metrics (aggregated, not storing actual emails)
CREATE TABLE IF NOT EXISTS email_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,

    -- Counts
    emails_received INTEGER DEFAULT 0,
    emails_sent INTEGER DEFAULT 0,
    emails_read INTEGER DEFAULT 0,

    -- Response metrics
    avg_response_time_minutes INTEGER,
    emails_responded INTEGER DEFAULT 0,

    -- Time-based patterns
    emails_outside_hours INTEGER DEFAULT 0,  -- Sent before 8am or after 6pm
    earliest_email_time TIME,
    latest_email_time TIME,

    -- Thread metrics
    active_threads INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(employee_id, date)
);

CREATE INDEX idx_email_metrics_employee ON email_metrics(employee_id, date DESC);

-- ============================================
-- PRIVACY SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS privacy_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- What managers can see
    show_health_to_manager BOOLEAN DEFAULT false,  -- Detailed health metrics
    show_sleep_to_manager BOOLEAN DEFAULT false,   -- Sleep data
    show_heart_to_manager BOOLEAN DEFAULT false,   -- Heart rate data
    show_exercise_to_manager BOOLEAN DEFAULT true, -- Exercise data
    show_work_to_manager BOOLEAN DEFAULT true,     -- Work metrics
    show_email_to_manager BOOLEAN DEFAULT true,    -- Email metrics
    show_calendar_to_manager BOOLEAN DEFAULT true, -- Calendar metrics

    -- Aggregation level for manager view
    manager_view_level VARCHAR(20) DEFAULT 'summary'
        CHECK (manager_view_level IN ('detailed', 'summary', 'zone_only')),

    -- Data retention preferences
    retain_detailed_data_days INTEGER DEFAULT 90,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(employee_id)
);

-- ============================================
-- WELLNESS STREAKS
-- ============================================
CREATE TABLE IF NOT EXISTS wellness_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Check-in streak
    current_checkin_streak INTEGER DEFAULT 0,
    longest_checkin_streak INTEGER DEFAULT 0,
    last_checkin_date DATE,

    -- Sleep goal streak
    current_sleep_streak INTEGER DEFAULT 0,
    longest_sleep_streak INTEGER DEFAULT 0,

    -- Exercise streak
    current_exercise_streak INTEGER DEFAULT 0,
    longest_exercise_streak INTEGER DEFAULT 0,

    -- Green zone streak
    current_green_streak INTEGER DEFAULT 0,
    longest_green_streak INTEGER DEFAULT 0,

    -- Total points/badges
    total_points INTEGER DEFAULT 0,
    badges JSONB DEFAULT '[]',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(employee_id)
);

-- ============================================
-- WELLNESS RESOURCES
-- ============================================
CREATE TABLE IF NOT EXISTS wellness_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('article', 'video', 'exercise', 'meditation', 'link')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('stress', 'sleep', 'exercise', 'nutrition', 'mindfulness', 'productivity', 'general')),
    url TEXT,
    content TEXT,  -- For inline content like exercises
    duration_minutes INTEGER,  -- For videos/meditations
    difficulty VARCHAR(20) CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wellness_resources_category ON wellness_resources(category, is_active);

-- Insert default wellness resources
INSERT INTO wellness_resources (title, description, content_type, category, content, duration_minutes, difficulty, tags) VALUES
('Box Breathing', 'A simple breathing technique to reduce stress and anxiety', 'exercise', 'mindfulness',
 '1. Breathe in for 4 seconds\n2. Hold for 4 seconds\n3. Breathe out for 4 seconds\n4. Hold for 4 seconds\n5. Repeat 4-6 times',
 5, 'beginner', ARRAY['breathing', 'stress-relief', 'quick']),

('Progressive Muscle Relaxation', 'Systematically tense and release muscle groups to reduce physical tension', 'exercise', 'stress',
 '1. Start with your feet - tense for 5 seconds, release\n2. Move to calves, thighs, glutes\n3. Continue to stomach, chest, arms\n4. Finish with shoulders, neck, face\n5. Take 3 deep breaths to finish',
 10, 'beginner', ARRAY['relaxation', 'tension', 'body']),

('5-4-3-2-1 Grounding', 'A grounding technique to manage anxiety and bring you to the present moment', 'exercise', 'mindfulness',
 'Notice:\n- 5 things you can SEE\n- 4 things you can TOUCH\n- 3 things you can HEAR\n- 2 things you can SMELL\n- 1 thing you can TASTE',
 3, 'beginner', ARRAY['anxiety', 'grounding', 'quick']),

('Sleep Hygiene Checklist', 'Best practices for better sleep quality', 'article', 'sleep',
 '**1 hour before bed:**\n- No screens or enable night mode\n- Dim the lights\n- Avoid caffeine after 2pm\n\n**Your bedroom:**\n- Cool temperature (65-68°F)\n- Dark (use blackout curtains)\n- Quiet (use white noise if needed)\n\n**Daily habits:**\n- Wake at the same time daily\n- Get morning sunlight\n- Exercise (but not within 3 hours of bed)',
 NULL, 'beginner', ARRAY['sleep', 'habits', 'checklist']),

('Pomodoro Technique', 'A time management method to improve focus and productivity', 'article', 'productivity',
 '**The Method:**\n1. Choose a task\n2. Set timer for 25 minutes\n3. Work until timer rings\n4. Take a 5-minute break\n5. Every 4 pomodoros, take a 15-30 minute break\n\n**Tips:**\n- Turn off notifications\n- If interrupted, note it and return to focus\n- Use breaks for movement',
 NULL, 'beginner', ARRAY['focus', 'productivity', 'time-management'])

ON CONFLICT DO NOTHING;

-- ============================================
-- CHECK-IN REMINDERS
-- ============================================
CREATE TABLE IF NOT EXISTS reminder_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Check-in reminders
    checkin_reminder_enabled BOOLEAN DEFAULT true,
    checkin_reminder_time TIME DEFAULT '09:00',
    checkin_reminder_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],  -- Monday-Friday

    -- Weekly summary
    weekly_summary_enabled BOOLEAN DEFAULT true,
    weekly_summary_day INTEGER DEFAULT 1,  -- Monday
    weekly_summary_time TIME DEFAULT '08:00',

    -- Push notifications
    push_enabled BOOLEAN DEFAULT false,
    push_subscription JSONB,

    -- Email notifications
    email_enabled BOOLEAN DEFAULT true,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id)
);

-- ============================================
-- PATTERN INSIGHTS
-- ============================================
CREATE TABLE IF NOT EXISTS detected_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    pattern_type VARCHAR(50) NOT NULL,  -- 'correlation', 'trend', 'anomaly', 'prediction'
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    -- Pattern details
    factors JSONB,  -- What factors are involved
    confidence DECIMAL(5,2),  -- How confident we are (0-100)
    impact VARCHAR(20) CHECK (impact IN ('positive', 'negative', 'neutral')),

    -- Time-based info
    time_period VARCHAR(50),  -- 'daily', 'weekly', 'monthly'
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Status
    is_active BOOLEAN DEFAULT true,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_detected_patterns_employee ON detected_patterns(employee_id, is_active, detected_at DESC);

-- ============================================
-- PREDICTIVE ALERTS
-- ============================================
CREATE TABLE IF NOT EXISTS predictive_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('burnout_risk', 'declining_trend', 'pattern_warning', 'recovery_opportunity')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),

    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Prediction details
    predicted_outcome VARCHAR(255),
    confidence DECIMAL(5,2),
    days_until_predicted INTEGER,

    -- Recommendations
    recommendations JSONB,

    -- Status
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES users(id),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_predictive_alerts_employee ON predictive_alerts(employee_id, is_acknowledged, created_at DESC);

-- ============================================
-- INTEGRATION TOKENS (Unified)
-- ============================================
-- Create google_calendar_tokens if not exists
CREATE TABLE IF NOT EXISTS google_calendar_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE,
    scope TEXT,
    gmail_scope_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- ============================================
-- 1:1 MEETING SUGGESTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS meeting_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    suggested_reason VARCHAR(255) NOT NULL,  -- 'declining_wellness', 'needs_support', 'celebrate_success', 'routine_checkin'
    urgency VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),

    -- Optimal time suggestions based on both calendars
    suggested_times JSONB,

    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'dismissed', 'completed')),
    scheduled_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_meeting_suggestions_manager ON meeting_suggestions(manager_id, status, created_at DESC);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE team_invitations IS 'Invitations for managers to add team members';
COMMENT ON TABLE gmail_tokens IS 'OAuth tokens for Gmail API access';
COMMENT ON TABLE email_metrics IS 'Aggregated email metrics (no actual email content stored)';
COMMENT ON TABLE privacy_settings IS 'Employee control over what data managers can see';
COMMENT ON TABLE wellness_streaks IS 'Gamification tracking for wellness habits';
COMMENT ON TABLE wellness_resources IS 'Library of wellness content';
COMMENT ON TABLE reminder_settings IS 'User preferences for reminders and notifications';
COMMENT ON TABLE detected_patterns IS 'AI-detected patterns in user behavior';
COMMENT ON TABLE predictive_alerts IS 'Proactive alerts before burnout occurs';
COMMENT ON TABLE meeting_suggestions IS '1:1 meeting suggestions for managers';
