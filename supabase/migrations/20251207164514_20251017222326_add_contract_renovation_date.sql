/*
  # Adicionar campo de data de renovação em contratos

  1. Alterações
    - Adiciona campo `data_renovacao` (date) na tabela `contracts`
    - Campo opcional para permitir especificar manualmente o mês/ano de renovação
    - Útil para contratos com períodos de renovação variados (mensal, anual, bienal, etc)

  2. Notas
    - Campo aceita valores nulos para contratos existentes
    - Permite flexibilidade para diferentes ciclos de renovação
    - Substitui cálculo automático baseado em data_inicio
*/

-- Adicionar campo de data de renovação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'data_renovacao'
  ) THEN
    ALTER TABLE contracts ADD COLUMN data_renovacao date;
  END IF;
END $$;