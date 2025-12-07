/*
  # Fix reminders modified timestamp trigger

  1. Changes
    - Update trigger function to use correct column name 'ultima_modificacao' instead of 'modified_at'
    
  2. Notes
    - The table has 'ultima_modificacao' column but the trigger was trying to update 'modified_at'
    - This was causing errors when updating reminder status
*/

CREATE OR REPLACE FUNCTION update_reminders_modified_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ultima_modificacao = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;