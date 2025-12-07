/*
  # Adicionar histórico de mudanças de status dos leads

  1. Nova Tabela
    - `lead_status_history`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key para leads)
      - `status_anterior` (text)
      - `status_novo` (text)
      - `responsavel` (text)
      - `observacao` (text, opcional)
      - `created_at` (timestamptz)
  
  2. Segurança
    - Habilitar RLS na tabela
    - Adicionar política de leitura para todos (público)
    - Adicionar política de inserção para todos (público)
*/

CREATE TABLE IF NOT EXISTS lead_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status_anterior text NOT NULL,
  status_novo text NOT NULL,
  responsavel text NOT NULL,
  observacao text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de histórico de status"
  ON lead_status_history
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Permitir inserção de histórico de status"
  ON lead_status_history
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead_id ON lead_status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_created_at ON lead_status_history(created_at DESC);