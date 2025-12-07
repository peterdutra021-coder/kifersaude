/*
  # Add Vidas (Lives) Counter to Contracts

  ## Description
  Adds a vidas (lives) counter field to contracts table to track the number
  of lives in each health insurance contract. This is used to calculate the
  lifetime bonus payment.

  ## Changes
  - Add vidas (integer) field to contracts table
  - Bonus calculation: bonus_por_vida_valor * vidas = total bonus to receive

  ## Notes
  - Vidas = Titular + Dependentes
  - Lifetime bonus is a one-time payment per life (not recurring)
  - Payment may be split but total = bonus_por_vida_valor * vidas
*/

-- Add vidas field to contracts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'vidas'
  ) THEN
    ALTER TABLE contracts ADD COLUMN vidas integer DEFAULT 1;
  END IF;
END $$;

-- Add index for vidas queries
CREATE INDEX IF NOT EXISTS idx_contracts_vidas ON contracts(vidas);

-- Add comment for documentation
COMMENT ON COLUMN contracts.vidas IS 'Número de vidas no contrato (titular + dependentes). Usado para calcular bônus: bonus_por_vida_valor * vidas';