-- Judge Scoring System Migration
-- Adds judge role, scoring tables, and judge assignments

-- Update users table to include judge role
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('audience', 'community_member', 'community_admin', 'judge'));

-- Judge assignments table (track which users have been assigned as judges for events)
CREATE TABLE IF NOT EXISTS judge_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    UNIQUE(event_id, judge_id)
);

-- Material scores table (judges score material submissions)
CREATE TABLE IF NOT EXISTS material_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES material_submissions(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
    max_score DECIMAL(5,2) DEFAULT 100,
    feedback TEXT,
    criteria_scores JSONB, -- Store individual criteria scores as JSON
    scored_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(submission_id, judge_id)
);

-- Overall team/individual scores (aggregated from material scores and other assessments)
CREATE TABLE IF NOT EXISTS participant_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant_name VARCHAR(255) NOT NULL,
    participant_email VARCHAR(255) NOT NULL,
    total_score DECIMAL(7,2) DEFAULT 0,
    material_score DECIMAL(7,2) DEFAULT 0,
    bonus_score DECIMAL(7,2) DEFAULT 0,
    penalty_score DECIMAL(7,2) DEFAULT 0,
    judge_count INTEGER DEFAULT 0, -- Number of judges who scored this participant
    last_updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, participant_id)
);

-- Scoring criteria table (define what criteria are used for scoring)
CREATE TABLE IF NOT EXISTS scoring_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    max_points DECIMAL(5,2) NOT NULL DEFAULT 10,
    weight DECIMAL(3,2) NOT NULL DEFAULT 1.0, -- Weight factor for this criterion
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_judge_assignments_event ON judge_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_judge ON judge_assignments(judge_id);
CREATE INDEX IF NOT EXISTS idx_judge_assignments_status ON judge_assignments(status);

CREATE INDEX IF NOT EXISTS idx_material_scores_submission ON material_scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_material_scores_judge ON material_scores(judge_id);
CREATE INDEX IF NOT EXISTS idx_material_scores_event ON material_scores(event_id);
CREATE INDEX IF NOT EXISTS idx_material_scores_scored_at ON material_scores(scored_at);

CREATE INDEX IF NOT EXISTS idx_participant_scores_event ON participant_scores(event_id);
CREATE INDEX IF NOT EXISTS idx_participant_scores_participant ON participant_scores(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_scores_total ON participant_scores(total_score);

CREATE INDEX IF NOT EXISTS idx_scoring_criteria_event ON scoring_criteria(event_id);
CREATE INDEX IF NOT EXISTS idx_scoring_criteria_active ON scoring_criteria(is_active);

-- Triggers to auto-update updated_at timestamps
DROP TRIGGER IF EXISTS update_material_scores_updated_at ON material_scores;
CREATE TRIGGER update_material_scores_updated_at BEFORE UPDATE ON material_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_participant_scores_updated_at ON participant_scores;
CREATE TRIGGER update_participant_scores_updated_at BEFORE UPDATE ON participant_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scoring_criteria_updated_at ON scoring_criteria;
CREATE TRIGGER update_scoring_criteria_updated_at BEFORE UPDATE ON scoring_criteria
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update participant total scores when material scores change
CREATE OR REPLACE FUNCTION update_participant_total_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the participant's total material score
    UPDATE participant_scores 
    SET 
        material_score = COALESCE((
            SELECT AVG(score) 
            FROM material_scores ms 
            JOIN material_submissions msub ON ms.submission_id = msub.id
            WHERE msub.attendee_id = 
                (SELECT attendee_id FROM material_submissions WHERE id = NEW.submission_id)
              AND ms.event_id = NEW.event_id
        ), 0),
        judge_count = (
            SELECT COUNT(DISTINCT judge_id)
            FROM material_scores ms 
            JOIN material_submissions msub ON ms.submission_id = msub.id
            WHERE msub.attendee_id = 
                (SELECT attendee_id FROM material_submissions WHERE id = NEW.submission_id)
              AND ms.event_id = NEW.event_id
        ),
        updated_at = CURRENT_TIMESTAMP
    WHERE event_id = NEW.event_id 
      AND participant_id = (SELECT attendee_id FROM material_submissions WHERE id = NEW.submission_id);

    -- Update total score (material + bonus - penalty)
    UPDATE participant_scores 
    SET total_score = material_score + bonus_score - penalty_score
    WHERE event_id = NEW.event_id 
      AND participant_id = (SELECT attendee_id FROM material_submissions WHERE id = NEW.submission_id);

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-calculate participant scores when material scores change
DROP TRIGGER IF EXISTS trigger_update_participant_score ON material_scores;
CREATE TRIGGER trigger_update_participant_score 
    AFTER INSERT OR UPDATE ON material_scores
    FOR EACH ROW EXECUTE FUNCTION update_participant_total_score();

-- Add permissions for judge role and new resources
INSERT INTO permissions (role, resource, action) VALUES
-- Judge permissions
('judge', 'events', 'read'),
('judge', 'communities', 'read'),
('judge', 'clubs', 'read'),
('judge', 'tasks', 'read'),
('judge', 'queries', 'read'),
('judge', 'members', 'read'),
('judge', 'materials', 'read'),
('judge', 'scores', 'create'),
('judge', 'scores', 'read'),
('judge', 'scores', 'update'),

-- Update existing admin permissions to include new resources
('community_admin', 'materials', 'create'),
('community_admin', 'materials', 'read'),
('community_admin', 'materials', 'update'),
('community_admin', 'materials', 'delete'),
('community_admin', 'scores', 'read'),

-- Community member permissions for materials
('community_member', 'materials', 'read'),
('community_member', 'materials', 'create'),

-- Audience permissions for materials (read-only)
('audience', 'materials', 'read')

ON CONFLICT (role, resource, action) DO NOTHING;

-- Create some default scoring criteria for events (can be customized per event)
INSERT INTO material_request_types (name, description) VALUES
('Presentation', 'PowerPoint or similar presentation materials'),
('Document', 'Written documents, reports, or papers'),
('Video', 'Video submissions or recordings'),
('Image', 'Images, graphics, or visual materials'),
('Code', 'Source code or programming projects'),
('Other', 'Other types of materials')
ON CONFLICT DO NOTHING;