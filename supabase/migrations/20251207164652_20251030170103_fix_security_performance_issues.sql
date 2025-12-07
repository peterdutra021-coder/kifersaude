/*
  # Fix Security and Performance Issues

  1. Missing Indexes
    - Add indexes for foreign keys in reminders table
    - Add index for foreign key in user_profiles table

  2. RLS Performance Optimization
    - Optimize all auth.uid() calls with (SELECT auth.uid())
    - Drop and recreate policies with optimized queries

  3. Function Search Path
    - Fix mutable search path in functions

  4. Unused Indexes
    - Keep indexes as they may be used in future queries
    - These are not security issues, just optimization notes
*/

-- ===================================
-- 1. Add Missing Foreign Key Indexes
-- ===================================

-- Index for reminders.contract_id foreign key
CREATE INDEX IF NOT EXISTS idx_reminders_contract_id_fk 
  ON reminders(contract_id);

-- Index for reminders.lead_id foreign key
CREATE INDEX IF NOT EXISTS idx_reminders_lead_id_fk 
  ON reminders(lead_id);

-- Index for user_profiles.created_by foreign key
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_by_fk 
  ON user_profiles(created_by);

-- ===================================
-- 2. Optimize RLS Policies
-- ===================================

-- Drop existing user_profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert new users" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete users" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Recreate with optimized auth.uid() calls

-- SELECT policies
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Admins can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM user_profiles up 
      WHERE up.id = (SELECT auth.uid()) 
        AND up.role = 'admin'
    )
  );

-- INSERT policies
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Admins can insert new users"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM user_profiles up 
      WHERE up.id = (SELECT auth.uid()) 
        AND up.role = 'admin'
    )
  );

-- UPDATE policy
CREATE POLICY "Admins can update profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM user_profiles up 
      WHERE up.id = (SELECT auth.uid()) 
        AND up.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM user_profiles up 
      WHERE up.id = (SELECT auth.uid()) 
        AND up.role = 'admin'
    )
  );

-- DELETE policy
CREATE POLICY "Admins can delete users"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM user_profiles up 
      WHERE up.id = (SELECT auth.uid()) 
        AND up.role = 'admin'
    )
  );

-- ===================================
-- 3. Fix Function Search Paths
-- ===================================

-- Fix update_reminders_modified_time function
CREATE OR REPLACE FUNCTION public.update_reminders_modified_time()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.modified_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'role', 'observer')
  );
  RETURN NEW;
END;
$$;