/*
  # Sistema de Permissões e Usuários

  ## Descrição
  Este migration cria o sistema de gerenciamento de usuários com diferentes níveis de permissão (admin e observador).

  ## 1. Nova Tabela: user_profiles
    - `id` (uuid, PK) - ID do usuário (referência para auth.users)
    - `email` (text) - Email do usuário
    - `role` (text) - Tipo de permissão: 'admin' ou 'observer'
    - `created_at` (timestamptz) - Data de criação
    - `created_by` (uuid) - ID do admin que criou o usuário

  ## 2. Segurança
    - RLS habilitado na tabela user_profiles
    - Apenas admins podem criar novos usuários
    - Usuários podem visualizar seu próprio perfil
    - Admins podem visualizar todos os perfis

  ## 3. Políticas de Acesso
    - Admins têm acesso total ao sistema
    - Observadores têm acesso somente-leitura:
      - Podem visualizar dashboard, leads, contratos e lembretes
      - NÃO podem criar, editar ou excluir nada
      - NÃO podem acessar configurações

  ## 4. Notas Importantes
    - O primeiro usuário criado será automaticamente admin
    - Observadores não podem alterar status, adicionar notas ou modificar dados
    - Sistema detecta automaticamente a role do usuário logado
*/

-- Criar tabela de perfis de usuários
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'observer' CHECK (role IN ('admin', 'observer')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Habilitar RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Política: Admins podem ver todos os perfis
CREATE POLICY "Admins can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Política: Admins podem inserir novos usuários
CREATE POLICY "Admins can insert new users"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Política: Admins podem atualizar perfis
CREATE POLICY "Admins can update profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Política: Admins podem deletar usuários
CREATE POLICY "Admins can delete users"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Função para criar automaticamente o perfil quando um novo usuário é criado via auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, created_by)
  VALUES (
    new.id,
    new.email,
    CASE 
      WHEN (SELECT COUNT(*) FROM public.user_profiles) = 0 THEN 'admin'
      ELSE 'observer'
    END,
    NULL
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);