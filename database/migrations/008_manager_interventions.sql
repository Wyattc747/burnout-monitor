-- Migration: Manager 1:1 Workflow Enhancement
-- Adds conversation templates, intervention tracking, and meeting outcome logging

-- ============================================
-- CONVERSATION TEMPLATES TABLE
-- ============================================
-- Provides conversation starters and talking points based on employee zone
CREATE TABLE IF NOT EXISTS conversation_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone VARCHAR(10) NOT NULL CHECK (zone IN ('red', 'yellow', 'green')),
    urgency VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),

    -- Template content
    title VARCHAR(255) NOT NULL,
    description TEXT,
    opening_questions JSONB NOT NULL,  -- Array of conversation starters
    talking_points JSONB NOT NULL,     -- Array of topics to cover
    actions_to_suggest JSONB,          -- Array of actionable suggestions

    -- Template metadata
    category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('general', 'burnout', 'stress', 'workload', 'growth', 'recognition', 'conflict')),
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversation_templates_zone ON conversation_templates(zone, is_active);
CREATE INDEX idx_conversation_templates_category ON conversation_templates(category, is_active);

-- ============================================
-- MANAGER INTERVENTIONS TABLE
-- ============================================
-- Track all manager interventions and their effectiveness
CREATE TABLE IF NOT EXISTS manager_interventions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    meeting_suggestion_id UUID REFERENCES meeting_suggestions(id) ON DELETE SET NULL,

    -- Meeting details
    meeting_type VARCHAR(50) DEFAULT '1:1' CHECK (meeting_type IN ('1:1', 'team', 'informal', 'follow_up')),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,

    -- Context at time of meeting
    employee_zone_before VARCHAR(10) CHECK (employee_zone_before IN ('red', 'yellow', 'green')),
    burnout_score_before DECIMAL(5,2),
    readiness_score_before DECIMAL(5,2),

    -- Meeting outcome
    outcome_rating INTEGER CHECK (outcome_rating >= 1 AND outcome_rating <= 5),  -- 1-5 how productive was the meeting
    outcome_notes TEXT,
    topics_discussed JSONB,  -- Array of topics covered
    action_items JSONB,      -- Array of agreed action items
    follow_up_needed BOOLEAN DEFAULT false,
    follow_up_date DATE,

    -- Effectiveness tracking (filled in after follow-up period)
    employee_zone_after VARCHAR(10) CHECK (employee_zone_after IN ('red', 'yellow', 'green')),
    burnout_score_after DECIMAL(5,2),
    readiness_score_after DECIMAL(5,2),
    effectiveness_calculated_at TIMESTAMP WITH TIME ZONE,
    improvement_score DECIMAL(5,2),  -- Calculated improvement (-100 to +100)

    -- Status
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_manager_interventions_manager ON manager_interventions(manager_id, created_at DESC);
CREATE INDEX idx_manager_interventions_employee ON manager_interventions(employee_id, created_at DESC);
CREATE INDEX idx_manager_interventions_status ON manager_interventions(status, scheduled_at);
CREATE INDEX idx_manager_interventions_effectiveness ON manager_interventions(manager_id, effectiveness_calculated_at) WHERE improvement_score IS NOT NULL;

-- ============================================
-- ADD COLUMNS TO MEETING_SUGGESTIONS
-- ============================================
-- Add outcome tracking columns to existing meeting_suggestions table
ALTER TABLE meeting_suggestions
    ADD COLUMN IF NOT EXISTS intervention_id UUID REFERENCES manager_interventions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS dismissed_reason TEXT;

-- ============================================
-- INSERT DEFAULT CONVERSATION TEMPLATES
-- ============================================
INSERT INTO conversation_templates (zone, urgency, title, description, opening_questions, talking_points, actions_to_suggest, category, display_order) VALUES

-- Red zone templates
('red', 'urgent', 'Burnout Support Conversation', 'Use when employee is showing clear burnout indicators',
 '["How are you feeling about work lately?", "I''ve noticed you might be under a lot of pressure - can we talk about it?", "What''s been the most challenging part of your week?"]',
 '["Acknowledge their challenges without judgment", "Explore root causes of stress", "Discuss immediate workload adjustments", "Talk about time off options", "Review deadlines and priorities"]',
 '["Redistribute urgent tasks to team members", "Cancel or reschedule non-essential meetings", "Approve time off request", "Set up daily check-ins for support", "Connect with EAP resources"]',
 'burnout', 1),

('red', 'high', 'Workload Assessment', 'Assess and adjust workload for overwhelmed employee',
 '["Walk me through your current projects", "Which tasks are causing the most stress?", "Do you feel you have the resources you need?"]',
 '["Review all current assignments", "Identify what can be delegated or delayed", "Discuss realistic timelines", "Explore skill gaps or training needs"]',
 '["Create prioritized task list together", "Reassign 2-3 tasks to other team members", "Extend deadlines where possible", "Schedule follow-up in 1 week"]',
 'workload', 2),

-- Yellow zone templates
('yellow', 'normal', 'Proactive Check-in', 'Regular 1:1 to maintain engagement and catch issues early',
 '["How have things been going since we last talked?", "What''s been going well for you lately?", "Any concerns you''d like to discuss?"]',
 '["Celebrate recent wins", "Review progress on goals", "Discuss any blockers", "Talk about career development", "Check on work-life balance"]',
 '["Update development plan", "Schedule training or mentoring", "Adjust goals if needed", "Plan for upcoming challenges"]',
 'general', 1),

('yellow', 'high', 'Early Stress Intervention', 'Address rising stress before it becomes burnout',
 '["I wanted to check in - how are you managing your workload?", "What could make your work easier right now?", "Are there any upcoming deadlines I should know about?"]',
 '["Review current stress triggers", "Discuss time management strategies", "Explore delegation options", "Talk about boundaries and saying no"]',
 '["Identify one task to remove this week", "Set up focus time blocks", "Review and optimize meeting schedule", "Check in again in 3-5 days"]',
 'stress', 2),

-- Green zone templates
('green', 'low', 'Growth and Development', 'Leverage high performance for career advancement',
 '["You''ve been doing great work - what would you like to focus on next?", "Where do you see your career heading?", "What skills would you like to develop?"]',
 '["Review career goals", "Discuss stretch assignments", "Talk about mentoring opportunities", "Explore leadership development", "Plan for promotion track"]',
 '["Assign a high-visibility project", "Set up mentoring relationship", "Enroll in training program", "Create 90-day development plan"]',
 'growth', 1),

('green', 'low', 'Recognition and Appreciation', 'Acknowledge excellent performance and maintain engagement',
 '["I wanted to recognize your great work on [project]", "What helped you succeed on this?", "How can we share your approach with the team?"]',
 '["Specific praise for achievements", "Discuss what''s working well", "Explore knowledge sharing opportunities", "Talk about future challenges they''d enjoy"]',
 '["Public recognition in team meeting", "Recommend for award/bonus", "Ask them to present to team", "Document success story for others"]',
 'recognition', 2)

ON CONFLICT DO NOTHING;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE conversation_templates IS 'Pre-built conversation guides for managers based on employee wellness zone';
COMMENT ON TABLE manager_interventions IS 'Track 1:1 meetings and their effectiveness on employee wellness';
COMMENT ON COLUMN manager_interventions.improvement_score IS 'Calculated score showing change in employee wellness after intervention (-100 to +100)';
