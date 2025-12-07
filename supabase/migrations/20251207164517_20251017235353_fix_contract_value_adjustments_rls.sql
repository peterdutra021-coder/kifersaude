/*
  # Corrigir Políticas RLS para Ajustes de Valor de Contratos

  ## Descrição
  Atualiza as políticas de Row Level Security da tabela contract_value_adjustments
  para permitir acesso público, consistente com as outras tabelas do sistema.

  ## Alterações
  - Remove políticas que requerem autenticação
  - Cria nova política unificada permitindo todas as operações
  - Mantém RLS habilitado para segurança da estrutura

  ## Segurança
  O acesso é controlado pela API key do projeto Supabase
*/

-- Remover políticas antigas de contract_value_adjustments
DROP POLICY IF EXISTS "Usuários autenticados podem ver ajustes" ON contract_value_adjustments;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir ajustes" ON contract_value_adjustments;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar ajustes" ON contract_value_adjustments;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar ajustes" ON contract_value_adjustments;

-- Criar nova política para contract_value_adjustments
CREATE POLICY "Permitir todas as operações em ajustes de valor"
  ON contract_value_adjustments FOR ALL
  USING (true)
  WITH CHECK (true);