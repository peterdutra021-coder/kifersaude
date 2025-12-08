# Sistema de Rastreamento de Mensagens do WhatsApp

## Visão Geral

Foi implementado um sistema completo de rastreamento e auditoria de mensagens do WhatsApp, capturando todas as edições, deleções e restaurações de mensagens. Este sistema fornece total transparência e conformidade para todas as comunicações via WhatsApp.

## O que foi Implementado

### 1. Estrutura do Banco de Dados

#### Nova Tabela: `whatsapp_message_history`
Armazena o histórico completo de todas as mudanças em mensagens:
- **action_type**: Tipo de ação (created, edited, deleted, restored)
- **old_body** / **new_body**: Conteúdo antes e depois da mudança
- **old_payload** / **new_payload**: Payload completo para auditoria
- **changed_by**: Quem fez a mudança
- **changed_at**: Timestamp da mudança

#### Novas Colunas em `whatsapp_messages`
- **is_deleted**: Marca se a mensagem foi apagada
- **deleted_at** / **deleted_by**: Quando e quem deletou
- **edit_count**: Quantidade de vezes que foi editada
- **edited_at**: Data da última edição
- **original_body**: Conteúdo original antes de edições

#### Trigger Automático
Um trigger do PostgreSQL registra automaticamente todas as mudanças na tabela de histórico sempre que uma mensagem é atualizada.

### 2. Webhook Handler Atualizado

O webhook (`supabase/functions/whatsapp-webhook/index.ts`) foi expandido para:

- **Detectar edições**: Identifica quando uma mensagem tem `edited_at` ou `edit_history`
- **Detectar deleções**: Identifica mensagens com `action.type === 'delete'` ou `type === 'revoked'`
- **Processar edições**: Função `processMessageEdit()` que:
  - Busca a mensagem existente
  - Preserva o conteúdo original
  - Incrementa o contador de edições
  - Atualiza o timestamp de edição
- **Processar deleções**: Função `processMessageDelete()` que:
  - Marca a mensagem como deletada (soft delete)
  - Preserva o conteúdo para auditoria
  - Registra quem deletou e quando

### 3. Serviço de Consulta de Histórico

Arquivo: `src/lib/messageHistoryService.ts`

Funções disponíveis:
- **getMessageHistory(messageId)**: Retorna todo o histórico de uma mensagem específica
- **getDeletedMessages(chatId, startDate, endDate)**: Lista mensagens deletadas com filtros
- **getEditedMessages(chatId, startDate, endDate)**: Lista mensagens editadas com filtros
- **getChatMessagesWithHistory(chatId, includeDeleted)**: Busca mensagens com opção de incluir deletadas
- **getMessageEditCount(chatId)**: Conta quantas mensagens foram editadas
- **getMessageDeleteCount(chatId)**: Conta quantas mensagens foram deletadas
- **getRecentHistoryActivity(daysBack)**: Atividade recente dos últimos N dias

### 4. Componentes de Interface

#### MessageHistoryModal
Modal completo para visualizar o histórico de uma mensagem:
- Timeline com todas as versões
- Diff visual mostrando o antes e depois
- Indicadores coloridos por tipo de ação
- Timestamps formatados
- Informação de quem fez cada mudança

#### MessageBubble (atualizado)
Indicadores visuais nas mensagens:
- **Badge "Editada"**: Aparece em mensagens editadas com ícone e contador
- **Mensagem deletada**: Texto riscado em itálico com data de deleção
- **Botão "Ver histórico"**: Aparece ao passar o mouse para acessar o modal
- Clique no badge de edição abre o histórico diretamente

#### MessageHistoryPanel
Painel de estatísticas e atividade:
- Cards com contadores de mensagens editadas e deletadas
- Timeline de atividade recente
- Recolhível/expansível
- Cores distintas por tipo de ação

#### WhatsAppTab (atualizado)
Integração completa:
- Passa todas as propriedades necessárias para MessageBubble
- Inclui MessageHistoryPanel na interface do chat
- Suporte a realtime para detectar mudanças instantaneamente

## Como Funciona

### Fluxo de Edição de Mensagem

1. WhatsApp envia webhook com mensagem editada (campo `edited_at` presente)
2. Webhook detecta a edição
3. `processMessageEdit()` é chamada
4. Busca a mensagem original no banco
5. Salva o conteúdo antigo no histórico (via trigger automático)
6. Atualiza a mensagem com novo conteúdo
7. Incrementa `edit_count` e registra `edited_at`
8. Interface atualiza automaticamente via realtime

### Fluxo de Deleção de Mensagem

1. WhatsApp envia webhook com `action.type === 'delete'`
2. Webhook detecta a deleção
3. `processMessageDelete()` é chamada
4. Busca a mensagem no banco
5. Marca `is_deleted = true` (soft delete - não remove fisicamente)
6. Registra `deleted_at` e `deleted_by`
7. Salva snapshot no histórico (via trigger)
8. Interface mostra "Mensagem apagada" em itálico

### Fluxo de Visualização de Histórico

1. Usuário clica em "Ver histórico" ou no badge "Editada"
2. Modal abre com loader
3. Chama `getMessageHistory(messageId)`
4. Busca todos os registros de histórico da mensagem
5. Exibe timeline ordenada cronologicamente
6. Mostra diff visual entre versões
7. Indica tipo de mudança com cores e ícones

## Configuração do Webhook Whapi Cloud

Para capturar todos os eventos, configure no painel da Whapi Cloud:

1. Acesse: https://gate.whapi.cloud/
2. Token: `7TL1JVJpv5P4XowMZueaQdV6Xf7mriQd`
3. Configure os eventos:
   - ✅ messages.create (POST)
   - ✅ messages.update (PUT/PATCH) - **IMPORTANTE para edições**
   - ✅ messages.delete (DELETE) - **IMPORTANTE para deleções**
   - ✅ statuses.update
   - ✅ groups.*

URL do webhook: `https://wovxndhgzchbytdkmdru.supabase.co/functions/v1/whatsapp-webhook`

## Recursos Implementados

✅ Rastreamento completo de edições
✅ Rastreamento completo de deleções
✅ Histórico completo de mudanças
✅ Soft delete (preserva dados para auditoria)
✅ Contador de edições por mensagem
✅ Indicadores visuais na interface
✅ Modal de histórico com timeline
✅ Diff visual entre versões
✅ Painel de estatísticas
✅ Filtros por data e chat
✅ Atividade recente
✅ Trigger automático de logging
✅ Realtime updates
✅ RLS habilitado (apenas admins)
✅ Build sem erros

## Índices Criados para Performance

- `idx_whatsapp_message_history_message_id`: Consultas por mensagem
- `idx_whatsapp_message_history_chat_id`: Consultas por chat
- `idx_whatsapp_message_history_action_type`: Filtros por tipo de ação
- `idx_whatsapp_messages_is_deleted`: Filtrar deletadas
- `idx_whatsapp_messages_edited_at`: Ordenar por edição
- `idx_whatsapp_messages_edit_count`: Filtrar editadas

## Segurança

- **RLS Habilitado**: Todas as tabelas têm Row Level Security
- **Apenas Admins**: Somente administradores podem ver o histórico completo
- **Soft Delete**: Mensagens deletadas não são removidas fisicamente
- **Auditoria Completa**: Todos os payloads originais são preservados
- **Trigger Protegido**: Logging automático não pode ser desabilitado manualmente

## Próximos Passos Sugeridos

1. **Notificações**: Criar alertas quando mensagens importantes são deletadas
2. **Exportação**: Adicionar opção de exportar histórico em PDF
3. **Configurações**: Permitir configurar tempo de retenção do histórico
4. **Dashboard**: Criar painel administrativo com métricas gerais
5. **Permissões**: Configurações granulares de quem pode ver histórico
6. **Relatórios**: Gerar relatórios periódicos de atividade

## Testando o Sistema

### Teste de Edição
1. Abra o WhatsApp e envie uma mensagem
2. Edite a mensagem no WhatsApp
3. No sistema, a mensagem deve mostrar badge "Editada"
4. Clique no badge para ver o histórico
5. Verifique o diff entre versões

### Teste de Deleção
1. Envie uma mensagem no WhatsApp
2. Delete a mensagem (Delete para todos)
3. No sistema, deve aparecer "Mensagem apagada" em itálico
4. Clique em "Ver histórico" para ver o conteúdo original

### Teste de Estatísticas
1. Selecione um chat com atividade
2. Verifique o painel de estatísticas na parte inferior
3. Expanda para ver contadores e atividade recente
4. Confirme que os números estão corretos

## Suporte e Debugging

Todos os logs são registrados no console do webhook:
- `whatsapp-webhook: mensagem editada detectada`
- `whatsapp-webhook: mensagem deletada detectada`
- `whatsapp-webhook: processando edição de mensagem`
- `whatsapp-webhook: processando deleção de mensagem`

Para verificar logs:
```bash
supabase functions logs whatsapp-webhook --tail
```

## Arquivos Modificados/Criados

### Banco de Dados
- `add_message_history_tracking.sql` - Nova migração

### Backend
- `supabase/functions/whatsapp-webhook/index.ts` - Atualizado

### Frontend - Serviços
- `src/lib/messageHistoryService.ts` - Novo

### Frontend - Componentes
- `src/components/communication/MessageHistoryModal.tsx` - Novo
- `src/components/communication/MessageHistoryPanel.tsx` - Novo
- `src/components/communication/MessageBubble.tsx` - Atualizado
- `src/components/communication/WhatsAppTab.tsx` - Atualizado

## Conclusão

O sistema está completamente funcional e pronto para rastrear todas as mudanças em mensagens do WhatsApp. Todos os eventos de edição e deleção são capturados automaticamente, registrados no histórico e exibidos na interface com indicadores visuais claros. O histórico completo de cada mensagem pode ser visualizado em um modal detalhado com diff visual entre versões.
