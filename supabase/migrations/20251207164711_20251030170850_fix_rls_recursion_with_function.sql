/*
  # Fix RLS Recursion with Helper Function

  1. Problem
    - Policies checking admin role cause infinite recursion
    - They query user_profiles table from within user_profiles policies

  2. Solution
    - Create a helper function that uses SECURITY DEFINER to bypass RLS
    - Use this function in policies instead of direct table queries

  3. Security
    - Function is SECURITY DEFINER but only returns current user's role
    - Cannot be exploited to access other users' data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert new users" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete users" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Create helper function to get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();
  
  RETURN COALESCE(user_role, 'observer');
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- Recreate policies using the helper function

-- SELECT policies (OR logic: own profile OR admin)
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR public.current_user_role() = 'admin'
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
  WITH CHECK (public.current_user_role() = 'admin');

-- UPDATE policy
CREATE POLICY "Admins can update profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() = 'admin')
  WITH CHECK (public.current_user_role() = 'admin');

-- DELETE policy
CREATE POLICY "Admins can delete users"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'admin');

-- Add comment
COMMENT ON FUNCTION public.current_user_role() IS 
  'Helper function to get current user role without causing RLS recursion. Uses SECURITY DEFINER to bypass RLS.';