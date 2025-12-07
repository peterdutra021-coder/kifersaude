-- Permitir múltiplos titulares por contrato e dependentes vinculados a titulares

-- Remover restrição de unicidade para permitir vários titulares por contrato
ALTER TABLE contract_holders
  DROP CONSTRAINT IF EXISTS contract_holders_contract_id_key;

-- Garantir coluna de vínculo do dependente com o titular
ALTER TABLE dependents
  ADD COLUMN IF NOT EXISTS holder_id uuid REFERENCES contract_holders(id) ON DELETE CASCADE;

-- Preencher holder_id baseado no titular existente do contrato
UPDATE dependents d
SET holder_id = ch.id
FROM contract_holders ch
WHERE d.contract_id = ch.contract_id
  AND d.holder_id IS NULL;

-- Exigir vínculo obrigatório
ALTER TABLE dependents
  ALTER COLUMN holder_id SET NOT NULL;

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_dependents_holder_id ON dependents(holder_id);