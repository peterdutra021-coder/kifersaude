/*
  # Adicionar status de confirmação (ACK) às mensagens

  1. Alterações
    - Adiciona coluna `ack_status` à tabela `whatsapp_messages`
    - ACK status representa o estado de entrega da mensagem:
      - 0: enviando
      - 1: enviado
      - 2: recebido
      - 3: lido
      - 4: ouvido (para áudios)
    - Adiciona índice para consultas por status
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'ack_status'
  ) THEN
    ALTER TABLE whatsapp_messages 
    ADD COLUMN ack_status INTEGER DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_ack_status 
ON whatsapp_messages(ack_status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_chat_timestamp 
ON whatsapp_messages(chat_id, timestamp DESC);