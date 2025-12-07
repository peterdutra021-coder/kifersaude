/*
  # Add Ully Origin and Migrate Existing Leads
  
  1. Changes
    - Updates all existing leads to have origin 'Ully'
    - This ensures all current leads are tagged with the new Ully origin
    
  2. Notes
    - This is a data migration that updates existing records
    - New leads can still use any of the available origins
    - The 'Ully' origin will be used to identify leads that should be hidden from observers
*/

-- Update all existing leads to have origin 'Ully'
UPDATE leads 
SET origem = 'Ully' 
WHERE origem != 'Ully' OR origem IS NULL;