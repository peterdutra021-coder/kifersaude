/*
  # Adicionar campo username à tabela user_profiles

  ## Resumo
  - Adiciona coluna username (UNIQUE NOT NULL) à tabela user_profiles
  - Gera usernames únicos para usuários existentes baseado no email
  - Atualiza trigger handle_new_user para gerar username automaticamente para novos usuários

  ## Alterações
  1. Adiciona coluna username
  2. Popula usernames para usuários existentes
  3. Atualiza função handle_new_user para incluir lógica de username
*/

-- Adicionar coluna username (nullable temporariamente)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS username text;

-- Gerar usernames para usuários existentes baseado no email
DO $$
DECLARE
  user_record RECORD;
  base_username text;
  candidate_username text;
  suffix integer;
BEGIN
  FOR user_record IN SELECT id, email FROM user_profiles WHERE username IS NULL LOOP
    -- Extrair parte do email antes do @
    base_username := lower(regexp_replace(split_part(user_record.email, '@', 1), '[^a-z0-9_.-]', '', 'gi'));
    
    IF base_username IS NULL OR base_username = '' THEN
      base_username := 'user';
    END IF;
    
    -- Encontrar username único
    candidate_username := base_username;
    suffix := 0;
    
    WHILE EXISTS (SELECT 1 FROM user_profiles WHERE username = candidate_username AND id <> user_record.id) LOOP
      suffix := suffix + 1;
      candidate_username := base_username || suffix::text;
    END LOOP;
    
    -- Atualizar com o username único
    UPDATE user_profiles SET username = candidate_username WHERE id = user_record.id;
  END LOOP;
END $$;

-- Tornar coluna NOT NULL e UNIQUE após popular
ALTER TABLE user_profiles 
ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_key ON user_profiles(username);

-- Atualizar função handle_new_user para incluir lógica de username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  base_username text;
  candidate_username text;
  suffix integer := 0;
  assigned_role text;
  metadata jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  email_value text;
BEGIN
  -- Extrair username do metadata ou gerar do email
  IF metadata ? 'username' THEN
    base_username := lower(regexp_replace(metadata->>'username', '[^a-z0-9_.-]', '', 'gi'));
  ELSE
    email_value := COALESCE(NEW.email, metadata->>'email', '');
    base_username := lower(regexp_replace(split_part(email_value, '@', 1), '[^a-z0-9_.-]', '', 'gi'));
  END IF;

  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;

  -- Encontrar username único
  candidate_username := base_username;
  
  WHILE EXISTS (SELECT 1 FROM public.user_profiles WHERE username = candidate_username AND id <> NEW.id) LOOP
    suffix := suffix + 1;
    candidate_username := base_username || suffix::text;
  END LOOP;

  -- Determinar role
  assigned_role := COALESCE(metadata->>'role', 'observer');
  IF assigned_role NOT IN ('admin', 'observer') THEN
    assigned_role := 'observer';
  END IF;

  -- Primeiro usuário é sempre admin
  IF assigned_role = 'observer' AND NOT EXISTS (SELECT 1 FROM public.user_profiles) THEN
    assigned_role := 'admin';
  END IF;

  -- Inserir ou atualizar perfil
  INSERT INTO public.user_profiles (id, email, username, role, created_by)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, metadata->>'email'),
    candidate_username,
    assigned_role,
    NULL
  )
  ON CONFLICT (id) DO UPDATE
    SET email = COALESCE(EXCLUDED.email, public.user_profiles.email),
        username = EXCLUDED.username,
        role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

-- Recriar trigger se não existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
