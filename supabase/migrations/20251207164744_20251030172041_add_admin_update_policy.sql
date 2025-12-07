/*
  # Add admin update policy for user_profiles

  1. Problem
    - Admins cannot update other users' profiles
    - When creating a new user, the update fails silently and may affect wrong user

  2. Solution
    - Add policy allowing admins to update any user profile
    - Use safe check: user must have admin role in their own profile

  3. Security
    - Only users with role='admin' can update other profiles
    - Regular users can still only update their own profile
*/

-- Create admin update policy
CREATE POLICY "Admins can update any profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Allow if user is admin (check via subquery on own profile)
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
  )
  WITH CHECK (
    -- Same check for the new values
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'admin'
    )
  );