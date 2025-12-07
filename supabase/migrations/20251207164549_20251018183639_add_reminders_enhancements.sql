/*
  # Add Reminders Enhancement Fields

  ## Description
  Adds new fields to support enhanced reminder functionality including recurrence, tags, 
  attachments, and completion tracking.

  ## Changes Made
  
  ### Modified Tables
  - `reminders`
    - Added `tags` (text array) - Custom tags for categorization
    - Added `recorrencia` (text) - Recurrence pattern (daily, weekly, monthly, yearly, none)
    - Added `recorrencia_config` (jsonb) - Configuration for recurrence (days, frequency, end date)
    - Added `tempo_estimado_minutos` (integer) - Estimated time to complete in minutes
    - Added `anexos` (jsonb) - Array of attachment references (file URLs, links)
    - Added `concluido_em` (timestamptz) - Timestamp when reminder was completed
    - Added `snooze_count` (integer) - Number of times reminder was snoozed
    - Added `ultima_modificacao` (timestamptz) - Last modification timestamp
  
  ### New Indexes
  - Added index on `tags` for faster filtering
  - Added index on `recorrencia` for recurring reminder queries
  - Added index on `concluido_em` for completion tracking

  ## Notes
  - All new fields are nullable to maintain backward compatibility
  - JSONB fields allow flexible schema for future enhancements
  - Indexes improve query performance for new features
*/

-- Add new columns to reminders table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reminders' AND column_name = 'tags'
  ) THEN
    ALTER TABLE reminders ADD COLUMN tags text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reminders' AND column_name = 'recorrencia'
  ) THEN
    ALTER TABLE reminders ADD COLUMN recorrencia text DEFAULT 'none';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reminders' AND column_name = 'recorrencia_config'
  ) THEN
    ALTER TABLE reminders ADD COLUMN recorrencia_config jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reminders' AND column_name = 'tempo_estimado_minutos'
  ) THEN
    ALTER TABLE reminders ADD COLUMN tempo_estimado_minutos integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reminders' AND column_name = 'anexos'
  ) THEN
    ALTER TABLE reminders ADD COLUMN anexos jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reminders' AND column_name = 'concluido_em'
  ) THEN
    ALTER TABLE reminders ADD COLUMN concluido_em timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reminders' AND column_name = 'snooze_count'
  ) THEN
    ALTER TABLE reminders ADD COLUMN snooze_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reminders' AND column_name = 'ultima_modificacao'
  ) THEN
    ALTER TABLE reminders ADD COLUMN ultima_modificacao timestamptz DEFAULT now();
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_reminders_tags ON reminders USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_reminders_recorrencia ON reminders(recorrencia);
CREATE INDEX IF NOT EXISTS idx_reminders_concluido_em ON reminders(concluido_em);

-- Create trigger to update ultima_modificacao
CREATE OR REPLACE FUNCTION update_reminders_modified_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ultima_modificacao = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_reminders_modified_time_trigger ON reminders;
CREATE TRIGGER update_reminders_modified_time_trigger
  BEFORE UPDATE ON reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_reminders_modified_time();