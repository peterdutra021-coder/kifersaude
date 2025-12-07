/*
  # Add commission receipt mode flag

  ## Description
  Adds a flag to contracts to indicate whether the expected commission will be
  received upfront (single payment) or spread across multiple months. This
  allows the application to display installment schedules when the commission is
  not advanced by the operator.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'contracts'
      AND column_name = 'comissao_recebimento_adiantado'
  ) THEN
    ALTER TABLE contracts
      ADD COLUMN comissao_recebimento_adiantado boolean DEFAULT true;

    COMMENT ON COLUMN contracts.comissao_recebimento_adiantado IS
      'Indica se a comissão prevista será recebida de forma adiantada (pagamento único).';
  END IF;
END $$;