-- Add project member roles (project-level admin support)
-- This allows making a user an admin for a specific project without global admin rights

ALTER TABLE project_members
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin'));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(project_id, role);
