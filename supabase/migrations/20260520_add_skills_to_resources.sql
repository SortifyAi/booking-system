-- Add skills JSONB column to resources table
ALTER TABLE resources ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_resources_skills ON resources USING GIN (skills);
CREATE INDEX IF NOT EXISTS idx_schedules_resource_id ON schedules(resource_id);
CREATE INDEX IF NOT EXISTS idx_blocks_resource_id ON blocks(resource_id);