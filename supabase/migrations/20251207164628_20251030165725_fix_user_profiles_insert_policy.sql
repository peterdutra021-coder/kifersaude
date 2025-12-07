/*
  # Fix user_profiles insert policy

  1. Changes
    - Add policy to allow users to insert their own profile
    - This fixes the infinite recursion when creating first admin user

  2. Security
    - Users can only insert their own profile (where id = auth.uid())
*/

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);