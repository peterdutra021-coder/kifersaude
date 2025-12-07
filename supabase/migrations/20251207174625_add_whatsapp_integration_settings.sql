/*
  # Adiciona tabela de configurações de integração e registro WhatsApp

  1. Nova Tabela
    - `integration_settings`
      - `id` (uuid, chave primária)
      - `slug` (text, único, identificador da integração)
      - `name` (text, nome amigável)
      - `description` (text, descrição da integração)
      - `settings` (jsonb, configurações em JSON)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Registros Iniciais
    - GPT Transcription (para áudios e textos)
    - WhatsApp Auto Contact (para automação de mensagens)

  3. Segurança
    - RLS habilitado
    - Apenas administradores podem gerenciar integrações
*/

CREATE TABLE IF NOT EXISTS integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_settings_slug
  ON integration_settings(slug);

CREATE OR REPLACE FUNCTION set_integration_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_integration_settings_updated_at ON integration_settings;
CREATE TRIGGER trg_integration_settings_updated_at
  BEFORE UPDATE ON integration_settings
  FOR EACH ROW
  EXECUTE FUNCTION set_integration_settings_updated_at();

ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage integration settings"
  ON integration_settings
  FOR ALL
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

-- Inserir configuração do GPT
INSERT INTO integration_settings (slug, name, description, settings)
VALUES (
  'gpt_transcription',
  'Integração Geral do GPT',
  'Configurações usadas para recursos do GPT, como transcrever áudios e reescrever mensagens.',
  jsonb_build_object(
    'apiKey', '',
    'textModel', 'gpt-4o-mini'
  )
)
ON CONFLICT (slug) DO NOTHING;

-- Inserir configuração do WhatsApp
INSERT INTO integration_settings (slug, name, description, settings)
VALUES (
  'whatsapp_auto_contact',
  'WhatsApp - Automação de Contato',
  'Configurações da API do WhatsApp para envio automático de mensagens.',
  jsonb_build_object(
    'enabled', true,
    'baseUrl', '',
    'sessionId', '',
    'apiKey', '',
    'statusOnSend', 'Contato Inicial',
    'messageFlow', '[]'::jsonb
  )
)
ON CONFLICT (slug) DO NOTHING;
