/*
  # Enable realtime for WhatsApp tables

  ## Description
  Habilita atualizações em tempo real para as tabelas whatsapp_chats e whatsapp_messages,
  permitindo que a interface atualize automaticamente quando novas mensagens chegam
  ou quando os chats são atualizados.

  ## Changes
  - Enable REPLICA IDENTITY FULL for whatsapp_chats
  - Enable REPLICA IDENTITY FULL for whatsapp_messages
  - Add tables to supabase_realtime publication
*/

ALTER TABLE public.whatsapp_chats REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
