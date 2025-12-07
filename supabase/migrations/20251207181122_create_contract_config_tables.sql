/*
  # Criação de Tabelas de Configuração de Contratos

  ## Descrição
  Cria as tabelas dedicadas para configurações de contratos que estavam faltando
  no banco de dados. Estas tabelas permitem gerenciar opções customizáveis
  para contratos através da interface administrativa.

  ## Novas Tabelas
  - `lead_tipos_contratacao` - Tipos de contratação de leads
  - `lead_responsaveis` - Responsáveis pelos leads
  - `contract_status_config` - Status de contratos
  - `contract_modalidades` - Modalidades de contratos
  - `contract_abrangencias` - Abrangências dos contratos
  - `contract_acomodacoes` - Tipos de acomodação
  - `contract_carencias` - Carências contratuais

  ## Segurança
  - RLS habilitado em todas as tabelas
  - Usuários autenticados podem visualizar
  - Apenas administradores podem gerenciar
*/

-- Função auxiliar para atualizar updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tipos de contratação de leads
CREATE TABLE IF NOT EXISTS lead_tipos_contratacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_lead_tipos_contratacao_ordem ON lead_tipos_contratacao(ordem);
CREATE INDEX IF NOT EXISTS idx_lead_tipos_contratacao_ativo ON lead_tipos_contratacao(ativo);

DROP TRIGGER IF EXISTS trg_lead_tipos_contratacao_updated_at ON lead_tipos_contratacao;
CREATE TRIGGER trg_lead_tipos_contratacao_updated_at
  BEFORE UPDATE ON lead_tipos_contratacao
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE lead_tipos_contratacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view lead tipos contratacao"
  ON lead_tipos_contratacao FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins manage lead tipos contratacao"
  ON lead_tipos_contratacao FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Responsáveis pelos leads
CREATE TABLE IF NOT EXISTS lead_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_lead_responsaveis_ordem ON lead_responsaveis(ordem);
CREATE INDEX IF NOT EXISTS idx_lead_responsaveis_ativo ON lead_responsaveis(ativo);

DROP TRIGGER IF EXISTS trg_lead_responsaveis_updated_at ON lead_responsaveis;
CREATE TRIGGER trg_lead_responsaveis_updated_at
  BEFORE UPDATE ON lead_responsaveis
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE lead_responsaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view lead responsaveis"
  ON lead_responsaveis FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins manage lead responsaveis"
  ON lead_responsaveis FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Status de contratos
CREATE TABLE IF NOT EXISTS contract_status_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_contract_status_config_ordem ON contract_status_config(ordem);
CREATE INDEX IF NOT EXISTS idx_contract_status_config_ativo ON contract_status_config(ativo);

DROP TRIGGER IF EXISTS trg_contract_status_config_updated_at ON contract_status_config;
CREATE TRIGGER trg_contract_status_config_updated_at
  BEFORE UPDATE ON contract_status_config
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE contract_status_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contract status"
  ON contract_status_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins manage contract status"
  ON contract_status_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Modalidades de contratos
CREATE TABLE IF NOT EXISTS contract_modalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_contract_modalidades_ordem ON contract_modalidades(ordem);
CREATE INDEX IF NOT EXISTS idx_contract_modalidades_ativo ON contract_modalidades(ativo);

DROP TRIGGER IF EXISTS trg_contract_modalidades_updated_at ON contract_modalidades;
CREATE TRIGGER trg_contract_modalidades_updated_at
  BEFORE UPDATE ON contract_modalidades
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE contract_modalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contract modalidades"
  ON contract_modalidades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins manage contract modalidades"
  ON contract_modalidades FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Abrangências dos contratos
CREATE TABLE IF NOT EXISTS contract_abrangencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_contract_abrangencias_ordem ON contract_abrangencias(ordem);
CREATE INDEX IF NOT EXISTS idx_contract_abrangencias_ativo ON contract_abrangencias(ativo);

DROP TRIGGER IF EXISTS trg_contract_abrangencias_updated_at ON contract_abrangencias;
CREATE TRIGGER trg_contract_abrangencias_updated_at
  BEFORE UPDATE ON contract_abrangencias
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE contract_abrangencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contract abrangencias"
  ON contract_abrangencias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins manage contract abrangencias"
  ON contract_abrangencias FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Tipos de acomodação
CREATE TABLE IF NOT EXISTS contract_acomodacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_contract_acomodacoes_ordem ON contract_acomodacoes(ordem);
CREATE INDEX IF NOT EXISTS idx_contract_acomodacoes_ativo ON contract_acomodacoes(ativo);

DROP TRIGGER IF EXISTS trg_contract_acomodacoes_updated_at ON contract_acomodacoes;
CREATE TRIGGER trg_contract_acomodacoes_updated_at
  BEFORE UPDATE ON contract_acomodacoes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE contract_acomodacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contract acomodacoes"
  ON contract_acomodacoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins manage contract acomodacoes"
  ON contract_acomodacoes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Carências contratuais
CREATE TABLE IF NOT EXISTS contract_carencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (label),
  UNIQUE (value)
);

CREATE INDEX IF NOT EXISTS idx_contract_carencias_ordem ON contract_carencias(ordem);
CREATE INDEX IF NOT EXISTS idx_contract_carencias_ativo ON contract_carencias(ativo);

DROP TRIGGER IF EXISTS trg_contract_carencias_updated_at ON contract_carencias;
CREATE TRIGGER trg_contract_carencias_updated_at
  BEFORE UPDATE ON contract_carencias
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE contract_carencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contract carencias"
  ON contract_carencias FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins manage contract carencias"
  ON contract_carencias FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );