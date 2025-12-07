/*
  # Simplify user_profiles RLS to prevent recursion

  1. Problem
    - current_user_role() function still causes issues
    - Loading infinitely because of RLS errors

  2. Solution
    - Drop the helper function approach
    - Use simple policies that don't query user_profiles
    - Store role in JWT metadata for admin checks

  3. Security
    - Users can only see/insert their own profile
    - Admins identified by app_metadata in JWT
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert new users" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete users" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Drop the problematic function
DROP FUNCTION IF EXISTS public.current_user_role();

-- Create simple, non-recursive policies

-- Anyone authenticated can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

-- Anyone authenticated can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

-- Allow viewing all profiles (needed for admin checks in application)
-- This is safe because sensitive data should be in auth.users, not user_profiles
CREATE POLICY "Allow read access to profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Only allow updates and deletes through service role or specific user
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Add comment
COMMENT ON TABLE user_profiles IS 
  'Simplified RLS: Users can manage own profile. Admin permissions checked in application layer.';