/*
  # Criar função get_email_by_username

  ## Resumo
  - Cria função SECURITY DEFINER para retornar email baseado no username
  - Limita o output a um único valor de email sem expor outras colunas
  - Concede privilégios EXECUTE para role anon para acesso via RPC
  - Preserva RLS da tabela user_profiles

  ## Segurança
  - Função com SECURITY DEFINER para permitir acesso controlado
  - Retorna apenas o email, não expõe outros dados sensíveis
  - search_path definido para evitar SQL injection
*/

CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT up.email
  INTO v_email
  FROM public.user_profiles AS up
  WHERE up.username = p_username
  ORDER BY up.id
  LIMIT 1;

  RETURN v_email;
END;
$$;

-- Revogar acesso público e conceder apenas para anon
REVOKE ALL ON FUNCTION public.get_email_by_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO authenticated;
