/*
  # Adicionar CASCADE UPDATE ao foreign key de origem em leads

  ## Descrição
  Garante que quando o nome de uma origem for atualizado na tabela lead_origens,
  essa mudança seja automaticamente propagada para todos os leads que referenciam
  aquela origem.

  ## Alterações
  - Remove o constraint fk_leads_origem existente
  - Recria o constraint com ON UPDATE CASCADE
*/

-- Ensure lead origin updates propagate to existing leads
ALTER TABLE leads DROP CONSTRAINT IF EXISTS fk_leads_origem;
ALTER TABLE leads
  ADD CONSTRAINT fk_leads_origem
    FOREIGN KEY (origem) REFERENCES lead_origens(nome)
    ON UPDATE CASCADE;
