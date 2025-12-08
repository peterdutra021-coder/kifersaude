/*
  # Sistema de Rastreamento de Edições e Deleções de Mensagens

  ## Descrição
  Adiciona capacidade completa de rastreamento de mudanças em mensagens do WhatsApp,
  incluindo edições, deleções e restaurações. Mantém histórico completo para auditoria
  e conformidade.

  ## 1. Nova Tabela: whatsapp_message_history
  Armazena todas as versões e mudanças de cada mensagem

  Campos:
  - `id` (uuid, primary key) - ID único do registro de histórico
  - `message_id` (text) - ID da mensagem original do WhatsApp
  - `chat_id` (text) - ID do chat
  - `action_type` (text) - Tipo de ação: 'created', 'edited', 'deleted', 'restored'
  - `old_body` (text) - Conteúdo anterior
  - `new_body` (text) - Novo conteúdo
  - `old_payload` (jsonb) - Payload completo anterior
  - `new_payload` (jsonb) - Novo payload completo
  - `changed_by` (text) - Quem fez a mudança
  - `changed_at` (timestamptz) - Quando aconteceu a mudança
  - `created_at` (timestamptz) - Quando registramos esta mudança

  ## 2. Novas Colunas em whatsapp_messages
  - `is_deleted` (boolean) - Marca se a mensagem foi apagada
  - `deleted_at` (timestamptz) - Quando foi deletada
  - `deleted_by` (text) - Quem deletou
  - `edited_at` (timestamptz) - Data da última edição
  - `edit_count` (integer) - Quantas vezes foi editada
  - `original_body` (text) - Conteúdo original antes de edições

  ## 3. Índices
  - Índices para consultas rápidas de histórico
  - Índices para filtrar mensagens editadas/deletadas

  ## 4. Segurança
  - RLS habilitado em whatsapp_message_history
  - Apenas admins podem visualizar histórico completo
*/

-- Criar tabela de histórico de mensagens
CREATE TABLE IF NOT EXISTS whatsapp_message_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL,
  chat_id text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('created', 'edited', 'deleted', 'restored')),
  old_body text,
  new_body text,
  old_payload jsonb DEFAULT '{}'::jsonb,
  new_payload jsonb DEFAULT '{}'::jsonb,
  changed_by text,
  changed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Adicionar novas colunas à tabela whatsapp_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN is_deleted boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN deleted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN deleted_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'edited_at'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN edited_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'edit_count'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN edit_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'original_body'
  ) THEN
    ALTER TABLE whatsapp_messages ADD COLUMN original_body text;
  END IF;
END $$;

-- Criar índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_history_message_id
  ON whatsapp_message_history(message_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_history_chat_id
  ON whatsapp_message_history(chat_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_history_action_type
  ON whatsapp_message_history(action_type, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_is_deleted
  ON whatsapp_messages(is_deleted) WHERE is_deleted = true;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_edited_at
  ON whatsapp_messages(edited_at DESC) WHERE edited_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_edit_count
  ON whatsapp_messages(edit_count) WHERE edit_count > 0;

-- Habilitar RLS na tabela de histórico
ALTER TABLE whatsapp_message_history ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso: apenas admins podem ver o histórico
CREATE POLICY "Admins can read message history"
  ON whatsapp_message_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Webhook can insert message history"
  ON whatsapp_message_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Função para registrar mudanças no histórico automaticamente
CREATE OR REPLACE FUNCTION log_message_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a mensagem foi editada
  IF OLD.body IS DISTINCT FROM NEW.body AND NEW.edit_count > OLD.edit_count THEN
    INSERT INTO whatsapp_message_history (
      message_id,
      chat_id,
      action_type,
      old_body,
      new_body,
      old_payload,
      new_payload,
      changed_at
    ) VALUES (
      NEW.id,
      NEW.chat_id,
      'edited',
      OLD.body,
      NEW.body,
      OLD.payload,
      NEW.payload,
      NEW.edited_at
    );
  END IF;

  -- Se a mensagem foi deletada
  IF OLD.is_deleted = false AND NEW.is_deleted = true THEN
    INSERT INTO whatsapp_message_history (
      message_id,
      chat_id,
      action_type,
      old_body,
      new_body,
      old_payload,
      new_payload,
      changed_by,
      changed_at
    ) VALUES (
      NEW.id,
      NEW.chat_id,
      'deleted',
      OLD.body,
      NULL,
      OLD.payload,
      NEW.payload,
      NEW.deleted_by,
      NEW.deleted_at
    );
  END IF;

  -- Se a mensagem foi restaurada
  IF OLD.is_deleted = true AND NEW.is_deleted = false THEN
    INSERT INTO whatsapp_message_history (
      message_id,
      chat_id,
      action_type,
      old_body,
      new_body,
      old_payload,
      new_payload,
      changed_at
    ) VALUES (
      NEW.id,
      NEW.chat_id,
      'restored',
      NULL,
      NEW.body,
      OLD.payload,
      NEW.payload,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para registrar mudanças automaticamente
DROP TRIGGER IF EXISTS whatsapp_messages_change_trigger ON whatsapp_messages;
CREATE TRIGGER whatsapp_messages_change_trigger
  AFTER UPDATE ON whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION log_message_change();

-- Comentários para documentação
COMMENT ON TABLE whatsapp_message_history IS 'Histórico completo de todas as mudanças em mensagens do WhatsApp (edições, deleções, restaurações)';
COMMENT ON COLUMN whatsapp_message_history.action_type IS 'Tipo de ação: created, edited, deleted, restored';
COMMENT ON COLUMN whatsapp_messages.is_deleted IS 'Indica se a mensagem foi deletada (soft delete para auditoria)';
COMMENT ON COLUMN whatsapp_messages.edit_count IS 'Quantidade de vezes que a mensagem foi editada';
COMMENT ON COLUMN whatsapp_messages.original_body IS 'Conteúdo original da mensagem antes de qualquer edição';
