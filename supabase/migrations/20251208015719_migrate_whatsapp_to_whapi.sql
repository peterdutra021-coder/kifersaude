/*
  # Migração do WhatsApp para Whapi Cloud API

  1. Mudanças
    - Remove campos antigos (baseUrl, sessionId, apiKey) das configurações do WhatsApp
    - Adiciona novo campo 'token' para autenticação Bearer da Whapi Cloud
    - Mantém compatibilidade com outros campos existentes (enabled, statusOnSend, messageFlow)

  2. Detalhes
    - Atualiza a estrutura da tabela integration_settings para integração WhatsApp
    - Remove dependências da API antiga
    - Prepara para uso da Whapi Cloud API (gate.whapi.cloud)

  3. Notas Importantes
    - Esta migração NÃO remove dados existentes
    - Administradores precisarão reconfigurar com o token da Whapi Cloud
    - O campo 'enabled' é mantido para controle de ativação
*/

DO $$
DECLARE
  current_settings jsonb;
  new_settings jsonb;
BEGIN
  SELECT settings INTO current_settings
  FROM integration_settings
  WHERE slug = 'whatsapp_auto_contact';

  IF current_settings IS NOT NULL THEN
    new_settings := jsonb_build_object(
      'enabled', COALESCE(current_settings->>'enabled', 'false')::boolean,
      'token', '',
      'statusOnSend', COALESCE(current_settings->>'statusOnSend', 'Contato Inicial'),
      'messageFlow', COALESCE(current_settings->'messageFlow', '[]'::jsonb)
    );

    UPDATE integration_settings
    SET
      settings = new_settings,
      description = 'Configurações da API Whapi Cloud para envio automático de mensagens WhatsApp.',
      updated_at = now()
    WHERE slug = 'whatsapp_auto_contact';

    RAISE NOTICE 'Configurações do WhatsApp migradas para Whapi Cloud. Token precisa ser configurado.';
  ELSE
    INSERT INTO integration_settings (slug, name, description, settings)
    VALUES (
      'whatsapp_auto_contact',
      'WhatsApp - Automação de Contato',
      'Configurações da API Whapi Cloud para envio automático de mensagens WhatsApp.',
      jsonb_build_object(
        'enabled', false,
        'token', '',
        'statusOnSend', 'Contato Inicial',
        'messageFlow', '[]'::jsonb
      )
    );

    RAISE NOTICE 'Registro de integração WhatsApp criado. Token precisa ser configurado.';
  END IF;
END $$;
