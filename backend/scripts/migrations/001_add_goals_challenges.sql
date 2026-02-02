-- Migration: 001_add_goals_challenges
-- Description: Add tables for goals, challenges, intervention logs, and conversation templates
-- Created: 2026-02-01

-- ============================================================================
-- 1. Goals Table
-- Tracks individual employee wellness goals (sleep, exercise, green_zone, checkin_streak)
-- ============================================================================
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    goal_type VARCHAR(50) NOT NULL CHECK (goal_type IN ('sleep', 'exercise', 'green_zone', 'checkin_streak')),
    target_value NUMERIC NOT NULL,
    current_value NUMERIC DEFAULT 0,
    deadline TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying goals by employee
CREATE INDEX IF NOT EXISTS idx_goals_employee_id ON goals(employee_id);
-- Index for filtering active goals
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

-- ============================================================================
-- 2. Challenges Table
-- Team/group challenges created by managers
-- ============================================================================
CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    challenge_type VARCHAR(50) NOT NULL,
    target_value NUMERIC NOT NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying challenges by creator (manager)
CREATE INDEX IF NOT EXISTS idx_challenges_created_by ON challenges(created_by);
-- Index for filtering active challenges
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
-- Index for date range queries
CREATE INDEX IF NOT EXISTS idx_challenges_dates ON challenges(start_date, end_date);

-- ============================================================================
-- 3. Challenge Participants Table
-- Tracks employees participating in challenges and their progress
-- ============================================================================
CREATE TABLE IF NOT EXISTS challenge_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    current_value NUMERIC DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(challenge_id, employee_id)
);

-- Index for querying participants by challenge
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_id ON challenge_participants(challenge_id);
-- Index for querying challenges by employee
CREATE INDEX IF NOT EXISTS idx_challenge_participants_employee_id ON challenge_participants(employee_id);

-- ============================================================================
-- 4. Conversation Templates Table
-- Pre-defined conversation guides for manager-employee meetings based on zone
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_type VARCHAR(10) NOT NULL CHECK (zone_type IN ('red', 'yellow', 'green')),
    title VARCHAR(255) NOT NULL,
    suggested_questions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying templates by zone type
CREATE INDEX IF NOT EXISTS idx_conversation_templates_zone_type ON conversation_templates(zone_type);

-- ============================================================================
-- 5. Intervention Logs Table
-- Records manager interventions and meetings with employees
-- ============================================================================
CREATE TABLE IF NOT EXISTS intervention_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    meeting_date TIMESTAMP NOT NULL,
    conversation_template_id UUID REFERENCES conversation_templates(id) ON DELETE SET NULL,
    outcome_notes TEXT,
    employee_zone_before VARCHAR(10) CHECK (employee_zone_before IN ('red', 'yellow', 'green')),
    employee_zone_after VARCHAR(10) CHECK (employee_zone_after IN ('red', 'yellow', 'green')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying interventions by manager
CREATE INDEX IF NOT EXISTS idx_intervention_logs_manager_id ON intervention_logs(manager_id);
-- Index for querying interventions by employee
CREATE INDEX IF NOT EXISTS idx_intervention_logs_employee_id ON intervention_logs(employee_id);
-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_intervention_logs_meeting_date ON intervention_logs(meeting_date);

-- ============================================================================
-- Seed default conversation templates
-- ============================================================================
INSERT INTO conversation_templates (zone_type, title, suggested_questions) VALUES
    ('red', 'Burnout Support Conversation', '["How are you feeling about your current workload?", "What is causing you the most stress right now?", "Are there any tasks we can delegate or postpone?", "When did you last take time off?", "What support do you need from me or the team?", "How is your sleep and overall health?"]'),
    ('red', 'Crisis Intervention', '["I have noticed some concerning patterns - can we talk about how things are going?", "What would make your day-to-day work more manageable?", "Are there any personal factors affecting your work that you feel comfortable sharing?", "What does success look like for you in the next two weeks?"]'),
    ('yellow', 'Early Warning Check-in', '["How has your week been going?", "Are there any upcoming deadlines causing concern?", "Do you feel you have a good work-life balance right now?", "What is one thing we could change to improve your experience?", "How are your energy levels throughout the day?"]'),
    ('yellow', 'Workload Assessment', '["Let us review your current projects - which ones feel manageable?", "Are there any meetings you feel are not productive?", "Do you have enough focus time for deep work?", "What tasks energize you vs drain you?"]'),
    ('green', 'Growth and Development', '["What new skills would you like to develop?", "Are there any projects you would like to take on?", "How can I better support your career goals?", "Would you be interested in mentoring others on the team?", "What aspects of your work are you most proud of?"]'),
    ('green', 'Recognition and Celebration', '["I wanted to acknowledge your great work on recent projects.", "What has been working well for you lately?", "How do you maintain your positive momentum?", "Are there best practices you could share with the team?"]')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Update trigger function for updated_at columns
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply update triggers to new tables
DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;
CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON goals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_challenges_updated_at ON challenges;
CREATE TRIGGER update_challenges_updated_at
    BEFORE UPDATE ON challenges
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversation_templates_updated_at ON conversation_templates;
CREATE TRIGGER update_conversation_templates_updated_at
    BEFORE UPDATE ON conversation_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_intervention_logs_updated_at ON intervention_logs;
CREATE TRIGGER update_intervention_logs_updated_at
    BEFORE UPDATE ON intervention_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
