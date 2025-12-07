/*
  # Add Bonus and Enhanced Commission Support

  ## Description
  Adds support for commissions above 100% (for PJ contracts) and lifetime bonus
  that varies by plan/product.

  ## Changes

  ### 1. operadoras table
  - Remove commission limit (allow > 100%)
  - Add bonus_por_vida (boolean) - indicates if operator offers lifetime bonus
  - Add bonus_padrao (numeric) - default lifetime bonus value

  ### 2. contracts table
  - Add bonus_por_vida_valor (numeric) - specific lifetime bonus for this contract
  - Add bonus_por_vida_aplicado (boolean) - whether bonus was applied
  - Update comissao_prevista to allow higher values

  ### 3. produtos_planos table
  - Add bonus_por_vida_valor (numeric) - specific bonus for this product
  - Add comissao_sugerida (numeric) - suggested commission for this product

  ## Notes
  - Commissions for PJ contracts can exceed 100%
  - Lifetime bonus is additional recurring revenue beyond standard commission
  - Bonus varies by operator and specific plan contracted
*/

-- Update operadoras table
DO $$
BEGIN
  -- Add bonus fields to operadoras if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operadoras' AND column_name = 'bonus_por_vida'
  ) THEN
    ALTER TABLE operadoras ADD COLUMN bonus_por_vida boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operadoras' AND column_name = 'bonus_padrao'
  ) THEN
    ALTER TABLE operadoras ADD COLUMN bonus_padrao numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Update contracts table
DO $$
BEGIN
  -- Add bonus fields to contracts if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'bonus_por_vida_valor'
  ) THEN
    ALTER TABLE contracts ADD COLUMN bonus_por_vida_valor numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'bonus_por_vida_aplicado'
  ) THEN
    ALTER TABLE contracts ADD COLUMN bonus_por_vida_aplicado boolean DEFAULT false;
  END IF;
END $$;

-- Update produtos_planos table
DO $$
BEGIN
  -- Add bonus and commission fields to produtos_planos if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produtos_planos' AND column_name = 'bonus_por_vida_valor'
  ) THEN
    ALTER TABLE produtos_planos ADD COLUMN bonus_por_vida_valor numeric(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produtos_planos' AND column_name = 'comissao_sugerida'
  ) THEN
    ALTER TABLE produtos_planos ADD COLUMN comissao_sugerida numeric(5,2) DEFAULT 0;
  END IF;
END $$;

-- Add index for bonus queries
CREATE INDEX IF NOT EXISTS idx_operadoras_bonus ON operadoras(bonus_por_vida) WHERE bonus_por_vida = true;
CREATE INDEX IF NOT EXISTS idx_contracts_bonus ON contracts(bonus_por_vida_aplicado) WHERE bonus_por_vida_aplicado = true;

-- Add comments for documentation
COMMENT ON COLUMN operadoras.bonus_por_vida IS 'Indica se a operadora oferece bônus por vida nos contratos';
COMMENT ON COLUMN operadoras.bonus_padrao IS 'Valor padrão do bônus por vida em reais';
COMMENT ON COLUMN contracts.bonus_por_vida_valor IS 'Valor do bônus por vida específico deste contrato em reais';
COMMENT ON COLUMN contracts.bonus_por_vida_aplicado IS 'Indica se o bônus por vida foi aplicado neste contrato';
COMMENT ON COLUMN produtos_planos.bonus_por_vida_valor IS 'Valor do bônus por vida específico para este produto/plano';
COMMENT ON COLUMN produtos_planos.comissao_sugerida IS 'Comissão sugerida para este produto (pode exceder 100% para PJ)';