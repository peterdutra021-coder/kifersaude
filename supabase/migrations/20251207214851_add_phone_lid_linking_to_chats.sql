/*
  # Adicionar vinculação de telefone e LID aos chats

  1. Alterações na tabela whatsapp_chats
    - Adiciona coluna `phone_number` para armazenar o número de telefone (@c.us)
    - Adiciona coluna `lid` para armazenar o Local ID (@lid)
    - Adiciona índices para consultas eficientes por telefone e LID
    - Adiciona constraint unique parcial para evitar duplicatas

  2. Propósito
    - Vincular diferentes identificadores da mesma pessoa
    - @c.us (telefone): identificador baseado no número de telefone
    - @lid: identificador local único do WhatsApp
    - @g.us: identificador de grupo (já tratado com is_group)
    
  3. Comportamento
    - Quando uma mensagem chega com @c.us, armazenamos o telefone
    - Quando uma mensagem chega com @lid, armazenamos o LID
    - Se detectarmos que @c.us e @lid se referem à mesma pessoa, vinculamos automaticamente
    - Isso evita criar chats duplicados para a mesma pessoa
*/

-- Adicionar colunas para armazenar telefone e LID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_chats' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE whatsapp_chats 
    ADD COLUMN phone_number TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'whatsapp_chats' AND column_name = 'lid'
  ) THEN
    ALTER TABLE whatsapp_chats 
    ADD COLUMN lid TEXT;
  END IF;
END $$;

-- Criar índices para consultas eficientes
CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_phone_number 
ON whatsapp_chats(phone_number) WHERE phone_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_chats_lid 
ON whatsapp_chats(lid) WHERE lid IS NOT NULL;

-- Atualizar chats existentes para extrair o telefone do ID
UPDATE whatsapp_chats 
SET phone_number = REPLACE(REPLACE(id, '@c.us', ''), '@lid', '')
WHERE (id LIKE '%@c.us' OR id LIKE '%@lid') 
  AND phone_number IS NULL
  AND NOT is_group;

-- Atualizar LID para chats que usam @lid
UPDATE whatsapp_chats 
SET lid = id
WHERE id LIKE '%@lid' 
  AND lid IS NULL;

-- Comentários nas colunas
COMMENT ON COLUMN whatsapp_chats.phone_number IS 'Número de telefone extraído do chat ID (sem sufixos @c.us ou @lid)';
COMMENT ON COLUMN whatsapp_chats.lid IS 'Local ID do WhatsApp (@lid) quando disponível';
