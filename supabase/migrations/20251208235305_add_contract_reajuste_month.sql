/*
  # Adicionar campo de mês de reajuste em contratos

  1. Alterações
    - Adiciona campo `mes_reajuste` (date) na tabela `contracts`
    - Campo opcional para registrar o mês utilizado nos cálculos de reajuste anual

  2. Notas
    - Mantém compatibilidade com contratos existentes permitindo valores nulos
    - Usa tipo date para facilitar ordenação, filtros e formatações padronizadas
*/

-- Adicionar campo de mês de reajuste
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'mes_reajuste'
  ) THEN
    ALTER TABLE contracts ADD COLUMN mes_reajuste date;
  END IF;
END $$;
