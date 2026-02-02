-- Migration: Team Challenges
-- Adds team challenges feature with support for individual and team competitions

-- ============================================
-- CHALLENGES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Challenge details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    challenge_type VARCHAR(50) NOT NULL CHECK (challenge_type IN ('steps', 'sleep_hours', 'checkins', 'green_zone_days')),
    competition_type VARCHAR(20) NOT NULL CHECK (competition_type IN ('individual', 'team')),

    -- Goals and timing
    target_value DECIMAL(10,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),

    -- Ownership
    created_by UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    team_id UUID REFERENCES employees(id),  -- For team-specific challenges, reference manager's employee ID

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure end date is after start date
    CONSTRAINT challenges_dates_valid CHECK (end_date > start_date)
);

CREATE INDEX idx_challenges_status ON challenges(status, start_date DESC);
CREATE INDEX idx_challenges_created_by ON challenges(created_by);
CREATE INDEX idx_challenges_team ON challenges(team_id);
CREATE INDEX idx_challenges_dates ON challenges(start_date, end_date);

-- ============================================
-- CHALLENGE PARTICIPANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS challenge_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- For team competitions
    team_name VARCHAR(100),

    -- Progress tracking
    progress DECIMAL(10,2) DEFAULT 0,

    -- Timestamps
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Each employee can only join a challenge once
    UNIQUE(challenge_id, employee_id)
);

CREATE INDEX idx_challenge_participants_challenge ON challenge_participants(challenge_id);
CREATE INDEX idx_challenge_participants_employee ON challenge_participants(employee_id);
CREATE INDEX idx_challenge_participants_team ON challenge_participants(team_name);

-- ============================================
-- FEELING CHECKINS TABLE (if not exists)
-- ============================================
-- This table may already exist, but we need it for the checkins challenge type
CREATE TABLE IF NOT EXISTS feeling_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,

    -- Check-in data
    feeling_score INTEGER CHECK (feeling_score >= 1 AND feeling_score <= 5),
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
    stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 5),
    notes TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feeling_checkins_employee ON feeling_checkins(employee_id, created_at DESC);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE challenges IS 'Team wellness challenges with various competition types';
COMMENT ON TABLE challenge_participants IS 'Tracks employee participation and progress in challenges';
COMMENT ON COLUMN challenges.challenge_type IS 'Type of metric being tracked: steps, sleep_hours, checkins, or green_zone_days';
COMMENT ON COLUMN challenges.competition_type IS 'Whether this is an individual or team-based competition';
COMMENT ON COLUMN challenge_participants.team_name IS 'Optional team name for team-based competitions';
COMMENT ON COLUMN challenge_participants.progress IS 'Calculated progress towards the challenge goal';
