-- Material Requests and Submissions Schema
-- Tables for admin to request materials and users to submit them

-- Material Request Types table
CREATE TABLE IF NOT EXISTS material_request_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Material Requests (created by admins/event organizers)
CREATE TABLE IF NOT EXISTS material_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    material_type VARCHAR(100) NOT NULL, -- e.g., 'ppt', 'document', 'image', 'video'
    file_format_allowed VARCHAR(255), -- e.g., '.ppt,.pptx,.pdf'
    max_file_size_mb INTEGER DEFAULT 50,
    due_date TIMESTAMP WITH TIME ZONE,
    is_mandatory BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Material Submissions (uploaded by attendees)
CREATE TABLE IF NOT EXISTS material_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    attendee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendee_name VARCHAR(255) NOT NULL,
    attendee_email VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL, -- path to uploaded file in storage
    file_size_bytes BIGINT,
    file_type VARCHAR(100),
    original_filename VARCHAR(255),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(request_id, attendee_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_material_requests_event ON material_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_created_by ON material_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_material_requests_status ON material_requests(status);
CREATE INDEX IF NOT EXISTS idx_material_submissions_request ON material_submissions(request_id);
CREATE INDEX IF NOT EXISTS idx_material_submissions_event ON material_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_material_submissions_attendee ON material_submissions(attendee_id);
CREATE INDEX IF NOT EXISTS idx_material_submissions_uploaded_at ON material_submissions(uploaded_at);

-- Trigger to auto-update updated_at for material_requests
CREATE TRIGGER update_material_requests_updated_at BEFORE UPDATE ON material_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to auto-update updated_at for material_submissions
CREATE TRIGGER update_material_submissions_updated_at BEFORE UPDATE ON material_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
