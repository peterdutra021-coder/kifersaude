/*
  # Add Commission Multiplier and Value Adjustments to Contracts

  ## Changes
  
  1. Contracts Table Updates
    - Add `comissao_multiplicador` (numeric) - Stores the commission multiplier (default 2.8)
    - Column allows flexible commission calculation instead of fixed 2.8x multiplier
  
  2. New Table: contract_value_adjustments
    - `id` (uuid, primary key) - Unique identifier
    - `contract_id` (uuid, foreign key) - References contracts table
    - `tipo` (text) - Type of adjustment: 'desconto' or 'acrescimo'
    - `valor` (numeric) - Amount of the adjustment in BRL
    - `motivo` (text) - Required reason/description for the adjustment
    - `created_at` (timestamptz) - Timestamp of creation
    - `created_by` (text) - User who created the adjustment (Luiza or Nick)
  
  3. Security
    - Enable RLS on new table
    - Add policies for authenticated users to manage adjustments
  
  4. Indexes
    - Add index on contract_id for fast adjustment queries
  
  ## Business Logic
  - Commission multiplier defaults to 2.8 for backward compatibility
  - Manual adjustments are tracked with full audit trail including reason
  - Final monthly payment = base value + adjustments (acrescimo) - adjustments (desconto)
  - Commission = (base monthly payment ± adjustments) × multiplier
*/

-- Add commission multiplier column to contracts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'comissao_multiplicador'
  ) THEN
    ALTER TABLE contracts ADD COLUMN comissao_multiplicador numeric(5,2) DEFAULT 2.8;
  END IF;
END $$;

-- Create contract value adjustments table
CREATE TABLE IF NOT EXISTS contract_value_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('desconto', 'acrescimo')),
  valor numeric(10,2) NOT NULL CHECK (valor > 0),
  motivo text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for fast queries by contract
CREATE INDEX IF NOT EXISTS idx_contract_value_adjustments_contract_id 
  ON contract_value_adjustments(contract_id);

-- Enable RLS on contract_value_adjustments table
ALTER TABLE contract_value_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contract_value_adjustments
CREATE POLICY "Usuários autenticados podem ver ajustes"
  ON contract_value_adjustments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir ajustes"
  ON contract_value_adjustments FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar ajustes"
  ON contract_value_adjustments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar ajustes"
  ON contract_value_adjustments FOR DELETE
  TO authenticated
  USING (true);