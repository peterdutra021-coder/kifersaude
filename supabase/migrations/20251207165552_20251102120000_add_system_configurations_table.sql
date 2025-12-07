/*
  # Add system_configurations table for dynamic settings

  ## Description
  Creates the system_configurations table expected by the frontend
  configuration service. Includes support columns (value, ativo, ordem, etc.)
  and supporting indexes, triggers, and policies consistent with
  config_options/role_access_rules tables.
*/

-- Ensure helper function exists to update timestamps
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table storing configurable options grouped by category
CREATE TABLE IF NOT EXISTS system_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  label text NOT NULL,
  value text DEFAULT '',
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (category, label)
);

-- Maintain backwards compatibility with potential "value" uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_configurations_category_value
  ON system_configurations(category, value);

CREATE INDEX IF NOT EXISTS idx_system_configurations_category
  ON system_configurations(category);

CREATE INDEX IF NOT EXISTS idx_system_configurations_ordem
  ON system_configurations(ordem);

-- Trigger to maintain updated_at column
DROP TRIGGER IF EXISTS trg_system_configurations_updated_at ON system_configurations;
CREATE TRIGGER trg_system_configurations_updated_at
  BEFORE UPDATE ON system_configurations
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Enable Row Level Security and provide sane defaults similar to other tables
ALTER TABLE system_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view system configurations" ON system_configurations;
CREATE POLICY "Authenticated users can view system configurations"
  ON system_configurations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only admins manage system configurations" ON system_configurations;
CREATE POLICY "Only admins manage system configurations"
  ON system_configurations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Seed default categories if they do not exist to avoid empty state
INSERT INTO system_configurations (category, label, value, ordem)
VALUES
  ('role_access_rules', 'observer:dashboard', 'observer:dashboard', 0)
ON CONFLICT DO NOTHING;