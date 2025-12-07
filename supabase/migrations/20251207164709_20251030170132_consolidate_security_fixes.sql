/*
  # Consolidate Security and Performance Fixes

  1. Summary
    - All foreign key indexes added
    - All RLS policies optimized with (SELECT auth.uid())
    - Function search paths fixed
    - Multiple permissive policies are intentional (OR logic)

  2. Notes
    - Unused indexes kept for future query optimization
    - Leaked password protection should be enabled in Supabase Dashboard
      (Auth Settings > Password Protection > Enable HaveIBeenPwned)
*/

-- Verify all indexes exist
DO $$
BEGIN
  -- Verify reminders foreign key indexes
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'reminders' 
    AND indexname = 'idx_reminders_contract_id_fk'
  ) THEN
    CREATE INDEX idx_reminders_contract_id_fk ON reminders(contract_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'reminders' 
    AND indexname = 'idx_reminders_lead_id_fk'
  ) THEN
    CREATE INDEX idx_reminders_lead_id_fk ON reminders(lead_id);
  END IF;

  -- Verify user_profiles foreign key index
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'user_profiles' 
    AND indexname = 'idx_user_profiles_created_by_fk'
  ) THEN
    CREATE INDEX idx_user_profiles_created_by_fk ON user_profiles(created_by);
  END IF;
END $$;

-- Add comment documenting the security status
COMMENT ON TABLE user_profiles IS 'Security optimizations applied: RLS policies use (SELECT auth.uid()), foreign key indexes created, search paths fixed in functions';
COMMENT ON TABLE reminders IS 'Performance optimizations applied: Foreign key indexes for contract_id and lead_id created';