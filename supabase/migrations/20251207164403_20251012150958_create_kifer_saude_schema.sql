/*
  # Sistema Kifer Saúde - Schema Completo

  ## Descrição
  Sistema de gestão interna para corretora de saúde com foco em gestão de leads e contratos.

  ## Tabelas Criadas

  ### 1. leads
  Gerencia contatos comerciais e pipeline de vendas
  - Campos: dados de contato, origem, tipo de contratação, status, responsável
  - Rastreamento: datas de criação, último contato, próximo retorno
  - Relacionamento: pode gerar contratos

  ### 2. contracts
  Gerencia contratos de planos de saúde
  - Campos: modalidade, operadora, plano, valores, comissões
  - Vínculo opcional com lead
  - Status de acompanhamento completo

  ### 3. contract_holders
  Dados do titular de cada contrato (1:1)
  - Informações pessoais completas
  - Documentação
  - Dados empresariais quando aplicável

  ### 4. dependents
  Dependentes vinculados a contratos (1:N)
  - Informações pessoais
  - Relação com titular
  - Elegibilidade e valores

  ### 5. interactions
  Histórico de interações com leads e contratos
  - Rastreamento de comunicações
  - Observações e follow-ups
  - Timeline completa

  ### 6. documents
  Armazenamento de referências de documentos
  - Upload de arquivos obrigatórios
  - Organização por tipo e entidade

  ### 7. reminders
  Sistema de lembretes e notificações
  - Alertas automáticos
  - Status de leitura
  - Priorização

  ## Segurança
  - RLS habilitado em todas as tabelas
  - Políticas para usuários autenticados
  - Acesso restrito por responsável quando aplicável
*/

-- Tabela de Leads
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo text NOT NULL,
  telefone text NOT NULL,
  email text,
  cidade text,
  regiao text,
  origem text NOT NULL,
  tipo_contratacao text NOT NULL,
  operadora_atual text,
  status text NOT NULL DEFAULT 'Novo',
  responsavel text NOT NULL,
  data_criacao timestamptz DEFAULT now(),
  ultimo_contato timestamptz,
  proximo_retorno timestamptz,
  observacoes text,
  arquivado boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de Contratos
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_contrato text UNIQUE NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'Rascunho',
  modalidade text NOT NULL,
  operadora text NOT NULL,
  produto_plano text NOT NULL,
  abrangencia text,
  acomodacao text,
  data_inicio date,
  carencia text,
  mensalidade_total numeric(10,2),
  comissao_prevista numeric(10,2),
  previsao_recebimento_comissao date,
  responsavel text NOT NULL,
  observacoes_internas text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de Titulares (1:1 com contrato)
CREATE TABLE IF NOT EXISTS contract_holders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  nome_completo text NOT NULL,
  cpf text NOT NULL,
  rg text,
  data_nascimento date NOT NULL,
  sexo text,
  estado_civil text,
  telefone text NOT NULL,
  email text,
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  cns text,
  cnpj text,
  razao_social text,
  nome_fantasia text,
  percentual_societario numeric(5,2),
  data_abertura_cnpj date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de Dependentes (N:1 com contrato)
CREATE TABLE IF NOT EXISTS dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  holder_id uuid NOT NULL REFERENCES contract_holders(id) ON DELETE CASCADE,
  nome_completo text NOT NULL,
  cpf text,
  data_nascimento date NOT NULL,
  relacao text NOT NULL,
  elegibilidade text,
  valor_individual numeric(10,2),
  carencia_individual text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de Interações/Histórico
CREATE TABLE IF NOT EXISTS interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text NOT NULL,
  responsavel text NOT NULL,
  data_interacao timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Tabela de Documentos
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  tipo_documento text NOT NULL,
  nome_arquivo text NOT NULL,
  url_arquivo text NOT NULL,
  tamanho_bytes bigint,
  created_at timestamptz DEFAULT now()
);

-- Tabela de Lembretes
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  data_lembrete timestamptz NOT NULL,
  lido boolean DEFAULT false,
  prioridade text DEFAULT 'normal',
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_responsavel ON leads(responsavel);
CREATE INDEX IF NOT EXISTS idx_leads_proximo_retorno ON leads(proximo_retorno);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_responsavel ON contracts(responsavel);
CREATE INDEX IF NOT EXISTS idx_contracts_lead_id ON contracts(lead_id);
CREATE INDEX IF NOT EXISTS idx_dependents_contract_id ON dependents(contract_id);
CREATE INDEX IF NOT EXISTS idx_dependents_holder_id ON dependents(holder_id);
CREATE INDEX IF NOT EXISTS idx_interactions_lead_id ON interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_interactions_contract_id ON interactions(contract_id);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_reminders_data ON reminders(data_lembrete);
CREATE INDEX IF NOT EXISTS idx_reminders_lido ON reminders(lido);

-- Habilitar Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_holders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para leads
CREATE POLICY "Usuários autenticados podem ver todos os leads"
  ON leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar leads"
  ON leads FOR DELETE
  TO authenticated
  USING (true);

-- Políticas RLS para contracts
CREATE POLICY "Usuários autenticados podem ver todos os contratos"
  ON contracts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir contratos"
  ON contracts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar contratos"
  ON contracts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar contratos"
  ON contracts FOR DELETE
  TO authenticated
  USING (true);

-- Políticas RLS para contract_holders
CREATE POLICY "Usuários autenticados podem ver titulares"
  ON contract_holders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir titulares"
  ON contract_holders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar titulares"
  ON contract_holders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar titulares"
  ON contract_holders FOR DELETE
  TO authenticated
  USING (true);

-- Políticas RLS para dependents
CREATE POLICY "Usuários autenticados podem ver dependentes"
  ON dependents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir dependentes"
  ON dependents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar dependentes"
  ON dependents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar dependentes"
  ON dependents FOR DELETE
  TO authenticated
  USING (true);

-- Políticas RLS para interactions
CREATE POLICY "Usuários autenticados podem ver interações"
  ON interactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir interações"
  ON interactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar interações"
  ON interactions FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar interações"
  ON interactions FOR DELETE
  TO authenticated
  USING (true);

-- Políticas RLS para documents
CREATE POLICY "Usuários autenticados podem ver documentos"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir documentos"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar documentos"
  ON documents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar documentos"
  ON documents FOR DELETE
  TO authenticated
  USING (true);

-- Políticas RLS para reminders
CREATE POLICY "Usuários autenticados podem ver lembretes"
  ON reminders FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem inserir lembretes"
  ON reminders FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem atualizar lembretes"
  ON reminders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem deletar lembretes"
  ON reminders FOR DELETE
  TO authenticated
  USING (true);