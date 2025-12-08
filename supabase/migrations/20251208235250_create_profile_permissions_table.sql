/*
  # Create profile permissions table

  ## Descrição
  Cria uma tabela dedicada para armazenar as permissões de acesso por perfil,
  incluindo regras de RLS e dados padrão para perfis existentes. Também migra
  permissões já configuradas em tabelas anteriores, quando disponíveis.

  ## Tabelas Criadas
  - profile_permissions: Armazena permissões de acesso por role e módulo

  ## Dados Iniciais
  - Permissões padrão para admin (acesso completo a todos os módulos)
  - Permissões padrão para observer (acesso limitado apenas visualização)

  ## Segurança
  - RLS habilitado
  - Todos usuários autenticados podem ver permissões
  - Apenas admins podem gerenciar permissões
*/

CREATE TABLE IF NOT EXISTS profile_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL,
  module text NOT NULL,
  can_view boolean DEFAULT true,
  can_edit boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role, module)
);

CREATE INDEX IF NOT EXISTS idx_profile_permissions_role ON profile_permissions(role);
CREATE INDEX IF NOT EXISTS idx_profile_permissions_module ON profile_permissions(module);

-- Migrar dados de role_access_rules se existir
DO $$
BEGIN
  IF to_regclass('public.role_access_rules') IS NOT NULL THEN
    INSERT INTO profile_permissions (role, module, can_view, can_edit, created_at, updated_at)
    SELECT role, module, can_view, can_edit, created_at, updated_at
    FROM role_access_rules
    ON CONFLICT (role, module) DO UPDATE
      SET
        can_view = EXCLUDED.can_view,
        can_edit = EXCLUDED.can_edit,
        updated_at = EXCLUDED.updated_at;
  END IF;
END $$;

-- Inserir permissões padrão
INSERT INTO profile_permissions (role, module, can_view, can_edit)
VALUES
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
ON CONFLICT (role, module) DO NOTHING;

-- Habilitar RLS
ALTER TABLE profile_permissions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated users can view profile permissions"
  ON profile_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage profile permissions"
  ON profile_permissions FOR ALL
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

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trg_profile_permissions_updated_at ON profile_permissions;
CREATE TRIGGER trg_profile_permissions_updated_at
  BEFORE UPDATE ON profile_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
