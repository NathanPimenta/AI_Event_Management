-- Migration: 004_round_based_events.sql
-- Description: Add round-based event system for hackathons and multi-round competitions

-- Add event_type column to events table
ALTER TABLE events ADD COLUMN event_type VARCHAR(50) DEFAULT 'standard' 
  CHECK (event_type IN ('standard', 'hackathon', 'competition', 'workshop'));

-- Create rounds table
CREATE TABLE IF NOT EXISTS event_rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    submission_deadline TIMESTAMP WITH TIME ZONE,
    max_teams INTEGER,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' 
      CHECK (status IN ('pending', 'active', 'closed', 'completed')),
    requirements TEXT,
    evaluation_criteria TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, round_number)
);

-- Create teams table (for hackathons and competitions)
CREATE TABLE IF NOT EXISTS event_teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_name VARCHAR(255) NOT NULL,
    team_lead_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, team_lead_id)
);

-- Create team members table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, user_id)
);

-- Create team round status table
CREATE TABLE IF NOT EXISTS team_round_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES event_rounds(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'active' 
      CHECK (status IN ('active', 'advanced', 'eliminated', 'withdrawn')),
    score DECIMAL(10, 2),
    advancement_reason TEXT,
    elimination_feedback TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, round_id)
);

-- Create round submissions table
CREATE TABLE IF NOT EXISTS round_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES event_rounds(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    submission_type VARCHAR(100),
    file_path TEXT,
    file_name VARCHAR(255),
    file_size_bytes BIGINT,
    github_link VARCHAR(500),
    demo_link VARCHAR(500),
    submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create round evaluations table (for judge scores)
CREATE TABLE IF NOT EXISTS round_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES round_submissions(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score DECIMAL(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
    comments TEXT,
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(submission_id, judge_id)
);

-- Create indexes for performance
CREATE INDEX idx_event_rounds_event_id ON event_rounds(event_id);
CREATE INDEX idx_event_rounds_status ON event_rounds(status);
CREATE INDEX idx_event_teams_event_id ON event_teams(event_id);
CREATE INDEX idx_event_teams_team_lead ON event_teams(team_lead_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_round_status_team_id ON team_round_status(team_id);
CREATE INDEX idx_team_round_status_round_id ON team_round_status(round_id);
CREATE INDEX idx_team_round_status_status ON team_round_status(status);
CREATE INDEX idx_round_submissions_team_id ON round_submissions(team_id);
CREATE INDEX idx_round_submissions_round_id ON round_submissions(round_id);
CREATE INDEX idx_round_evaluations_submission_id ON round_evaluations(submission_id);
CREATE INDEX idx_round_evaluations_judge_id ON round_evaluations(judge_id);

-- Create triggers for auto-updating updated_at
CREATE TRIGGER update_event_rounds_updated_at BEFORE UPDATE ON event_rounds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_teams_updated_at BEFORE UPDATE ON event_teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_round_status_updated_at BEFORE UPDATE ON team_round_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_round_submissions_updated_at BEFORE UPDATE ON round_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_round_evaluations_updated_at BEFORE UPDATE ON round_evaluations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
