/*
  # Adicionar campo author para mensagens de grupo

  1. Alterações
    - Adiciona coluna `author` à tabela `whatsapp_messages`
    - Campo armazena o ID do participante que enviou a mensagem em grupos
    - Útil para identificar quem enviou cada mensagem em conversas de grupo
    - Adiciona índice para consultas por autor
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_messages' AND column_name = 'author'
  ) THEN
    ALTER TABLE whatsapp_messages 
    ADD COLUMN author TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_author 
ON whatsapp_messages(author);

COMMENT ON COLUMN whatsapp_messages.author IS 'ID do participante que enviou a mensagem (para grupos)';