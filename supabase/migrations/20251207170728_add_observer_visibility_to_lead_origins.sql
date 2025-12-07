/*
  # Add Observer Visibility to Lead Origins

  1. Changes
    - Add `visivel_para_observadores` column to `lead_origens` table
    - Default value is `true` for all origins
    - Allows controlling which lead origins are visible to observer role users
*/

ALTER TABLE lead_origens
  ADD COLUMN IF NOT EXISTS visivel_para_observadores boolean DEFAULT true;

UPDATE lead_origens
SET visivel_para_observadores = true
WHERE visivel_para_observadores IS NULL;