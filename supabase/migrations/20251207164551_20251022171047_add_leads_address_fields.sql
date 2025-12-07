/*
  # Add address fields to leads table

  1. Changes
    - Add `cep` column to `leads` table (optional text field for postal code)
    - Add `endereco` column to `leads` table (optional text field for street address)
    - Add `estado` column to `leads` table (optional text field for state)
  
  2. Notes
    - These fields support the CEP lookup functionality in the lead form
    - All fields are nullable as they are optional in the form
    - Uses IF NOT EXISTS to prevent errors if columns already exist
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'cep'
  ) THEN
    ALTER TABLE leads ADD COLUMN cep text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'endereco'
  ) THEN
    ALTER TABLE leads ADD COLUMN endereco text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'estado'
  ) THEN
    ALTER TABLE leads ADD COLUMN estado text;
  END IF;
END $$;