/*
  # Configuration Tables for System Settings

  ## Description
  Creates comprehensive configuration tables to support system-wide settings,
  notification preferences, and business data management.

  ## New Tables

  ### 1. system_settings
  Global system configuration (single row)
  - `id` (uuid, primary key)
  - `company_name` (text) - Company name
  - `notification_sound_enabled` (boolean) - Enable notification sounds
  - `notification_volume` (numeric) - Notification volume (0-1)
  - `notification_interval_seconds` (integer) - How often to check for notifications
  - `session_timeout_minutes` (integer) - Auto logout time
  - `date_format` (text) - Date format preference
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. operadoras
  Health insurance companies/operators
  - `id` (uuid, primary key)
  - `nome` (text) - Operator name
  - `comissao_padrao` (numeric) - Default commission percentage
  - `prazo_recebimento_dias` (integer) - Average payment days
  - `ativo` (boolean) - Active status
  - `observacoes` (text) - Notes
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. produtos_planos
  Health plan products
  - `id` (uuid, primary key)
  - `operadora_id` (uuid) - Foreign key to operadoras
  - `nome` (text) - Product/plan name
  - `modalidade` (text) - Contract type (PME, Empresarial, etc)
  - `abrangencia` (text) - Coverage area
  - `acomodacao` (text) - Accommodation type
  - `ativo` (boolean) - Active status
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 4. lead_status_config
  Custom lead status configuration
  - `id` (uuid, primary key)
  - `nome` (text) - Status name
  - `cor` (text) - Color hex code
  - `ordem` (integer) - Display order
  - `ativo` (boolean) - Active status
  - `padrao` (boolean) - Is default status
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. lead_origens
  Lead source configuration
  - `id` (uuid, primary key)
  - `nome` (text) - Origin name
  - `ativo` (boolean) - Active status
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Admin-only write access
  - Read access for authenticated users
*/

-- System Settings Table (single row configuration)
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text DEFAULT 'Kifer Saúde',
  notification_sound_enabled boolean DEFAULT true,
  notification_volume numeric(3,2) DEFAULT 0.70,
  notification_interval_seconds integer DEFAULT 30,
  session_timeout_minutes integer DEFAULT 480,
  date_format text DEFAULT 'DD/MM/YYYY',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Operadoras (Health Insurance Companies)
CREATE TABLE IF NOT EXISTS operadoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  comissao_padrao numeric(5,2) DEFAULT 0,
  prazo_recebimento_dias integer DEFAULT 30,
  ativo boolean DEFAULT true,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Produtos/Planos
CREATE TABLE IF NOT EXISTS produtos_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operadora_id uuid REFERENCES operadoras(id) ON DELETE CASCADE,
  nome text NOT NULL,
  modalidade text,
  abrangencia text,
  acomodacao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Lead Status Configuration
CREATE TABLE IF NOT EXISTS lead_status_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  cor text DEFAULT '#6B7280',
  ordem integer DEFAULT 0,
  ativo boolean DEFAULT true,
  padrao boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Lead Origins Configuration
CREATE TABLE IF NOT EXISTS lead_origens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text UNIQUE NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_operadoras_ativo ON operadoras(ativo);
CREATE INDEX IF NOT EXISTS idx_produtos_operadora ON produtos_planos(operadora_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos_planos(ativo);
CREATE INDEX IF NOT EXISTS idx_status_ordem ON lead_status_config(ordem);
CREATE INDEX IF NOT EXISTS idx_status_ativo ON lead_status_config(ativo);
CREATE INDEX IF NOT EXISTS idx_origens_ativo ON lead_origens(ativo);

-- Insert default system settings
INSERT INTO system_settings (id)
VALUES (gen_random_uuid())
ON CONFLICT (id) DO NOTHING;

-- Insert default operadoras
INSERT INTO operadoras (nome, comissao_padrao, prazo_recebimento_dias) VALUES
  ('Unimed', 8.00, 30),
  ('Bradesco Saúde', 8.00, 30),
  ('SulAmérica', 8.00, 30),
  ('Amil', 8.00, 30),
  ('Porto Seguro', 8.00, 30),
  ('NotreDame Intermédica', 8.00, 30),
  ('Hapvida', 8.00, 30),
  ('Prevent Senior', 8.00, 30),
  ('São Francisco Saúde', 8.00, 30),
  ('Golden Cross', 8.00, 30)
ON CONFLICT (nome) DO NOTHING;

-- Insert default lead status
INSERT INTO lead_status_config (nome, cor, ordem, padrao) VALUES
  ('Novo', '#3B82F6', 1, true),
  ('Contato Inicial', '#8B5CF6', 2, false),
  ('Em Análise', '#F59E0B', 3, false),
  ('Proposta Enviada', '#10B981', 4, false),
  ('Negociação', '#06B6D4', 5, false),
  ('Aguardando Documentos', '#F97316', 6, false),
  ('Convertido', '#22C55E', 7, false),
  ('Perdido', '#EF4444', 8, false),
  ('Sem Interesse', '#6B7280', 9, false)
ON CONFLICT (nome) DO NOTHING;

-- Insert default lead origins
INSERT INTO lead_origens (nome) VALUES
  ('Site'),
  ('Instagram'),
  ('Facebook'),
  ('Indicação'),
  ('Google Ads'),
  ('Telefone'),
  ('Email'),
  ('Outros')
ON CONFLICT (nome) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE operadoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_status_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_origens ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_settings
CREATE POLICY "Anyone can view system settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update system settings"
  ON system_settings FOR UPDATE
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

-- RLS Policies for operadoras
CREATE POLICY "Anyone can view operadoras"
  ON operadoras FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert operadoras"
  ON operadoras FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update operadoras"
  ON operadoras FOR UPDATE
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

CREATE POLICY "Only admins can delete operadoras"
  ON operadoras FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- RLS Policies for produtos_planos
CREATE POLICY "Anyone can view produtos"
  ON produtos_planos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert produtos"
  ON produtos_planos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update produtos"
  ON produtos_planos FOR UPDATE
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

CREATE POLICY "Only admins can delete produtos"
  ON produtos_planos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- RLS Policies for lead_status_config
CREATE POLICY "Anyone can view status config"
  ON lead_status_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert status config"
  ON lead_status_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update status config"
  ON lead_status_config FOR UPDATE
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

CREATE POLICY "Only admins can delete status config"
  ON lead_status_config FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- RLS Policies for lead_origens
CREATE POLICY "Anyone can view origens"
  ON lead_origens FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can insert origens"
  ON lead_origens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can update origens"
  ON lead_origens FOR UPDATE
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

CREATE POLICY "Only admins can delete origens"
  ON lead_origens FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );