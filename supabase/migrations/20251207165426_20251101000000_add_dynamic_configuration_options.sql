/*
  # Dynamic configuration options and role access rules

  ## Description
  Adds generic configuration tables to allow administrators to customize
  selectable options across the application (lead origins, contract metadata, etc.)
  and to manage module-level permissions per user role.
*/

-- Generic configuration options table
CREATE TABLE IF NOT EXISTS config_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  label text NOT NULL,
  value text NOT NULL,
  description text,
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_config_options_category_value
  ON config_options(category, value);

CREATE INDEX IF NOT EXISTS idx_config_options_category
  ON config_options(category);

-- Role access control table
CREATE TABLE IF NOT EXISTS role_access_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  module text NOT NULL,
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role, module)
);

-- Insert default configuration values
INSERT INTO config_options (category, label, value, ordem) VALUES
  ('lead_tipo_contratacao', 'Pessoa Física', 'Pessoa Física', 1),
  ('lead_tipo_contratacao', 'MEI', 'MEI', 2),
  ('lead_tipo_contratacao', 'CNPJ', 'CNPJ', 3),
  ('lead_tipo_contratacao', 'Adesão', 'Adesão', 4),
  ('lead_responsavel', 'Luiza', 'Luiza', 1),
  ('lead_responsavel', 'Nick', 'Nick', 2),
  ('contract_status', 'Rascunho', 'Rascunho', 1),
  ('contract_status', 'Em análise', 'Em análise', 2),
  ('contract_status', 'Documentos pendentes', 'Documentos pendentes', 3),
  ('contract_status', 'Proposta enviada', 'Proposta enviada', 4),
  ('contract_status', 'Aguardando assinatura', 'Aguardando assinatura', 5),
  ('contract_status', 'Emitido', 'Emitido', 6),
  ('contract_status', 'Ativo', 'Ativo', 7),
  ('contract_status', 'Suspenso', 'Suspenso', 8),
  ('contract_status', 'Cancelado', 'Cancelado', 9),
  ('contract_status', 'Encerrado', 'Encerrado', 10),
  ('contract_modalidade', 'PF', 'PF', 1),
  ('contract_modalidade', 'MEI', 'MEI', 2),
  ('contract_modalidade', 'CNPJ', 'CNPJ', 3),
  ('contract_modalidade', 'Adesão', 'Adesão', 4),
  ('contract_abrangencia', 'Nacional', 'Nacional', 1),
  ('contract_abrangencia', 'Regional', 'Regional', 2),
  ('contract_abrangencia', 'Estadual', 'Estadual', 3),
  ('contract_acomodacao', 'Enfermaria', 'Enfermaria', 1),
  ('contract_acomodacao', 'Apartamento', 'Apartamento', 2),
  ('contract_carencia', 'Padrão', 'padrão', 1),
  ('contract_carencia', 'Reduzida', 'reduzida', 2),
  ('contract_carencia', 'Portabilidade', 'portabilidade', 3),
  ('contract_carencia', 'Zero', 'zero', 4)
ON CONFLICT DO NOTHING;

-- Default role access rules
INSERT INTO role_access_rules (role, module, can_view, can_edit) VALUES
  ('admin', 'dashboard', true, true),
  ('admin', 'leads', true, true),
  ('admin', 'contracts', true, true),
  ('admin', 'reminders', true, true),
  ('admin', 'email', true, true),
  ('admin', 'blog', true, true),
  ('admin', 'config', true, true),
  ('observer', 'dashboard', true, false),
  ('observer', 'leads', true, false),
  ('observer', 'contracts', true, false),
  ('observer', 'reminders', true, false),
  ('observer', 'email', false, false),
  ('observer', 'blog', false, false),
  ('observer', 'config', false, false)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE config_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_access_rules ENABLE ROW LEVEL SECURITY;

-- Policies for config_options
CREATE POLICY "Authenticated users can view config options"
  ON config_options FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage config options"
  ON config_options FOR ALL
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

-- Policies for role_access_rules
CREATE POLICY "Authenticated users can view role access rules"
  ON role_access_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage role access rules"
  ON role_access_rules FOR ALL
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

-- Trigger to auto update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_config_options_updated_at ON config_options;
CREATE TRIGGER trg_config_options_updated_at
  BEFORE UPDATE ON config_options
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_role_access_rules_updated_at ON role_access_rules;
CREATE TRIGGER trg_role_access_rules_updated_at
  BEFORE UPDATE ON role_access_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();