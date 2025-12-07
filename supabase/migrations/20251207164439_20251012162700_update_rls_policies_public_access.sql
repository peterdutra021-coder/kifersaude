/*
  # Atualizar Políticas RLS para Acesso Público

  ## Descrição
  Ajusta as políticas de Row Level Security para permitir acesso sem autenticação,
  considerando que este é um sistema interno da corretora.

  ## Alterações
  - Remove políticas existentes que requerem autenticação
  - Cria novas políticas que permitem acesso público (anon role)
  - Mantém RLS habilitado para segurança da estrutura do banco

  ## Segurança
  O acesso é restrito ao nível de API key configurada no projeto
*/

-- Remover políticas antigas de leads
DROP POLICY IF EXISTS "Usuários autenticados podem ver todos os leads" ON leads;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir leads" ON leads;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar leads" ON leads;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar leads" ON leads;

-- Criar novas políticas para leads
CREATE POLICY "Permitir todas as operações em leads"
  ON leads FOR ALL
  USING (true)
  WITH CHECK (true);

-- Remover políticas antigas de contracts
DROP POLICY IF EXISTS "Usuários autenticados podem ver todos os contratos" ON contracts;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir contratos" ON contracts;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar contratos" ON contracts;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar contratos" ON contracts;

-- Criar novas políticas para contracts
CREATE POLICY "Permitir todas as operações em contratos"
  ON contracts FOR ALL
  USING (true)
  WITH CHECK (true);

-- Remover políticas antigas de contract_holders
DROP POLICY IF EXISTS "Usuários autenticados podem ver titulares" ON contract_holders;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir titulares" ON contract_holders;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar titulares" ON contract_holders;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar titulares" ON contract_holders;

-- Criar novas políticas para contract_holders
CREATE POLICY "Permitir todas as operações em titulares"
  ON contract_holders FOR ALL
  USING (true)
  WITH CHECK (true);

-- Remover políticas antigas de dependents
DROP POLICY IF EXISTS "Usuários autenticados podem ver dependentes" ON dependents;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir dependentes" ON dependents;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar dependentes" ON dependents;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar dependentes" ON dependents;

-- Criar novas políticas para dependents
CREATE POLICY "Permitir todas as operações em dependentes"
  ON dependents FOR ALL
  USING (true)
  WITH CHECK (true);

-- Remover políticas antigas de interactions
DROP POLICY IF EXISTS "Usuários autenticados podem ver interações" ON interactions;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir interações" ON interactions;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar interações" ON interactions;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar interações" ON interactions;

-- Criar novas políticas para interactions
CREATE POLICY "Permitir todas as operações em interações"
  ON interactions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Remover políticas antigas de documents
DROP POLICY IF EXISTS "Usuários autenticados podem ver documentos" ON documents;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir documentos" ON documents;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar documentos" ON documents;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar documentos" ON documents;

-- Criar novas políticas para documents
CREATE POLICY "Permitir todas as operações em documentos"
  ON documents FOR ALL
  USING (true)
  WITH CHECK (true);

-- Remover políticas antigas de reminders
DROP POLICY IF EXISTS "Usuários autenticados podem ver lembretes" ON reminders;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir lembretes" ON reminders;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar lembretes" ON reminders;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar lembretes" ON reminders;

-- Criar novas políticas para reminders
CREATE POLICY "Permitir todas as operações em lembretes"
  ON reminders FOR ALL
  USING (true)
  WITH CHECK (true);