import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-Whapi-Event',
};

type StoredEvent = {
  event: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
};

type WhapiMessage = {
  id: string;
  from_me: boolean;
  type: string;
  chat_id: string;
  timestamp: number;
  source?: string;
  text?: {
    body: string;
  };
  from?: string;
  from_name?: string;
  image?: {
    mime_type: string;
    file_size: number;
    link: string;
  };
  video?: {
    mime_type: string;
    file_size: number;
    link: string;
  };
  audio?: {
    mime_type: string;
    file_size: number;
    link: string;
  };
  voice?: {
    mime_type: string;
    file_size: number;
    link: string;
  };
  document?: {
    mime_type: string;
    file_size: number;
    link: string;
    filename?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
};

type WhapiWebhook = {
  messages?: WhapiMessage[];
  event: {
    type: string;
    event: string;
  };
  channel_id?: string;
};

type NormalizedMessage = {
  chatId: string;
  messageId: string;
  direction: 'inbound' | 'outbound';
  fromNumber: string | null;
  toNumber: string | null;
  type: string | null;
  body: string | null;
  hasMedia: boolean;
  timestamp: string | null;
  contactName: string | null;
  isGroup: boolean;
  author: string | null;
  ackStatus: number | null;
  payload: Record<string, unknown>;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function respond(body: Record<string, unknown>, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractEventName(payload: WhapiWebhook, headers: Headers): string {
  const headerEvent = headers.get('x-whapi-event');
  if (headerEvent && headerEvent.trim()) {
    return headerEvent.trim();
  }

  if (payload.event && typeof payload.event === 'object') {
    const eventType = payload.event.type || '';
    const eventAction = payload.event.event || '';
    return `${eventType}.${eventAction}`.trim();
  }

  return 'unknown';
}

function extractHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

async function storeEvent(event: StoredEvent) {
  const { error } = await supabase.from('whatsapp_webhook_events').insert(event);

  if (error) {
    throw new Error(`Erro ao salvar evento: ${error.message}`);
  }
}

function toIsoString(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

function normalizeWhapiMessage(message: WhapiMessage): NormalizedMessage {
  const messageId = message.id;
  const direction: 'inbound' | 'outbound' = message.from_me ? 'outbound' : 'inbound';
  const chatId = message.chat_id;
  const isGroup = chatId.endsWith('@g.us');

  let body = '';
  let hasMedia = false;

  if (message.text?.body) {
    body = message.text.body;
  } else if (message.image) {
    body = '[Imagem]';
    hasMedia = true;
  } else if (message.video) {
    body = '[Vídeo]';
    hasMedia = true;
  } else if (message.audio) {
    body = '[Áudio]';
    hasMedia = true;
  } else if (message.voice) {
    body = '[Mensagem de voz]';
    hasMedia = true;
  } else if (message.document) {
    body = `[Documento${message.document.filename ? ': ' + message.document.filename : ''}]`;
    hasMedia = true;
  } else if (message.location) {
    body = '[Localização]';
    hasMedia = true;
  }

  const fromNumber = direction === 'inbound' ? (message.from || chatId) : null;
  const toNumber = direction === 'outbound' ? chatId : null;
  const contactName = message.from_name || null;
  const timestamp = toIsoString(message.timestamp);

  const normalized: NormalizedMessage = {
    chatId,
    messageId,
    direction,
    fromNumber,
    toNumber,
    type: message.type,
    body,
    hasMedia,
    timestamp,
    contactName,
    isGroup,
    author: isGroup && fromNumber ? fromNumber : null,
    ackStatus: null,
    payload: JSON.parse(JSON.stringify(message)),
  };

  console.log('whatsapp-webhook: mensagem Whapi normalizada', {
    messageId: normalized.messageId,
    chatId: normalized.chatId,
    direction: normalized.direction,
    contactName: normalized.contactName,
    body: normalized.body?.substring(0, 50),
    type: message.type,
  });

  return normalized;
}

function extractPhoneNumber(chatId: string): string {
  return chatId.replace(/@c\.us$|@g\.us$|@lid$/, '');
}

function getChatIdType(chatId: string): 'group' | 'phone' | 'lid' | 'unknown' {
  if (chatId.endsWith('@g.us')) return 'group';
  if (chatId.endsWith('@c.us')) return 'phone';
  if (chatId.endsWith('@lid')) return 'lid';
  return 'unknown';
}

async function findExistingChatByPhone(phoneNumber: string, currentChatId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('whatsapp_chats')
    .select('id, phone_number, lid')
    .eq('phone_number', phoneNumber)
    .neq('id', currentChatId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.id;
}

async function mergeChatMessages(fromChatId: string, toChatId: string) {
  console.log('whatsapp-webhook: mesclando mensagens de chats duplicados', {
    fromChatId,
    toChatId,
  });

  const { error: updateError } = await supabase
    .from('whatsapp_messages')
    .update({ chat_id: toChatId })
    .eq('chat_id', fromChatId);

  if (updateError) {
    console.error('whatsapp-webhook: erro ao mesclar mensagens', updateError);
    return;
  }

  const { error: deleteError } = await supabase
    .from('whatsapp_chats')
    .delete()
    .eq('id', fromChatId);

  if (deleteError) {
    console.error('whatsapp-webhook: erro ao deletar chat duplicado', deleteError);
  }
}

async function findLeadByPhone(phoneNumber: string): Promise<string | null> {
  const cleanPhone = phoneNumber.replace(/\D/g, '');

  const { data, error } = await supabase
    .from('leads')
    .select('nome_completo, telefone')
    .or(`telefone.eq.${phoneNumber},telefone.eq.${cleanPhone}`)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.nome_completo;
}

async function resolveChatName(message: NormalizedMessage): Promise<string> {
  if (message.isGroup) {
    const { data: existingChat } = await supabase
      .from('whatsapp_chats')
      .select('name')
      .eq('id', message.chatId)
      .maybeSingle();

    if (existingChat?.name) {
      return existingChat.name;
    }

    return message.contactName ?? message.chatId;
  }

  const phoneNumber = extractPhoneNumber(message.chatId);

  const leadName = await findLeadByPhone(phoneNumber);
  if (leadName) {
    console.log('whatsapp-webhook: nome do lead encontrado no CRM', {
      chatId: message.chatId,
      leadName,
    });
    return leadName;
  }

  if (message.direction === 'inbound' && message.contactName) {
    return message.contactName;
  }

  const { data: existingChat } = await supabase
    .from('whatsapp_chats')
    .select('name')
    .eq('id', message.chatId)
    .maybeSingle();

  if (existingChat?.name) {
    return existingChat.name;
  }

  return message.contactName ?? message.chatId;
}

async function upsertChat(message: NormalizedMessage) {
  const lastMessageAt = message.timestamp ?? new Date().toISOString();
  const chatName = await resolveChatName(message);
  const chatIdType = getChatIdType(message.chatId);

  const phoneNumber = !message.isGroup ? extractPhoneNumber(message.chatId) : null;
  const lid = chatIdType === 'lid' ? message.chatId : null;

  console.log('whatsapp-webhook: upsert chat', {
    chatId: message.chatId,
    chatName,
    chatIdType,
    phoneNumber,
    lid,
    direction: message.direction,
    contactName: message.contactName,
  });

  if (phoneNumber && !message.isGroup) {
    const existingChatId = await findExistingChatByPhone(phoneNumber, message.chatId);

    if (existingChatId) {
      console.log('whatsapp-webhook: chat existente encontrado para o mesmo telefone', {
        newChatId: message.chatId,
        existingChatId,
        phoneNumber,
      });

      await mergeChatMessages(message.chatId, existingChatId);

      const { data: existingChat } = await supabase
        .from('whatsapp_chats')
        .select('lid')
        .eq('id', existingChatId)
        .maybeSingle();

      const updateData: any = {
        name: chatName,
        last_message_at: lastMessageAt,
        updated_at: new Date().toISOString(),
      };

      if (lid && !existingChat?.lid) {
        updateData.lid = lid;
        console.log('whatsapp-webhook: vinculando LID ao chat existente', {
          chatId: existingChatId,
          lid,
        });
      }

      const { error: updateError } = await supabase
        .from('whatsapp_chats')
        .update(updateData)
        .eq('id', existingChatId);

      if (updateError) {
        throw new Error(`Erro ao atualizar chat existente: ${updateError.message}`);
      }

      message.chatId = existingChatId;
      return;
    }
  }

  const { error } = await supabase.from('whatsapp_chats').upsert(
    {
      id: message.chatId,
      name: chatName,
      is_group: message.isGroup,
      phone_number: phoneNumber,
      lid: lid,
      last_message_at: lastMessageAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(`Erro ao salvar chat: ${error.message}`);
  }
}

async function upsertMessage(message: NormalizedMessage) {
  const { error } = await supabase.from('whatsapp_messages').upsert(
    {
      id: message.messageId,
      chat_id: message.chatId,
      from_number: message.fromNumber,
      to_number: message.toNumber,
      type: message.type,
      body: message.body,
      has_media: message.hasMedia,
      timestamp: message.timestamp,
      payload: message.payload,
      direction: message.direction,
      author: message.author,
      ack_status: message.ackStatus,
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(`Erro ao salvar mensagem: ${error.message}`);
  }
}

async function updateMessageAck(messageId: string, ackStatus: number) {
  console.log('whatsapp-webhook: atualizando ack da mensagem', {
    messageId,
    ackStatus,
    ackLabel: getAckLabel(ackStatus),
  });

  const { error } = await supabase
    .from('whatsapp_messages')
    .update({ ack_status: ackStatus })
    .eq('id', messageId);

  if (error) {
    throw new Error(`Erro ao atualizar ACK da mensagem: ${error.message}`);
  }
}

function getAckLabel(ack: number): string {
  const labels: Record<number, string> = {
    0: 'enviando',
    1: 'enviado',
    2: 'recebido',
    3: 'lido',
    4: 'ouvido',
  };
  return labels[ack] || 'desconhecido';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, { status: 405 });
  }

  let payload: WhapiWebhook;

  try {
    payload = await req.json();
  } catch (error) {
    console.error('whatsapp-webhook: erro ao ler payload', error);
    return respond({ error: 'Payload inválido' }, { status: 400 });
  }

  const headers = extractHeaders(req.headers);
  const eventName = extractEventName(payload, req.headers);

  console.log('whatsapp-webhook: evento Whapi recebido', {
    eventName,
    channelId: payload.channel_id,
    messagesCount: payload.messages?.length || 0,
    eventType: payload.event?.type,
    eventAction: payload.event?.event,
  });

  try {
    await storeEvent({ event: eventName, payload: payload as unknown as Record<string, unknown>, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('whatsapp-webhook: erro ao salvar evento', message, { eventName, payload });
  }

  const isMessageEvent = eventName.toLowerCase().includes('messages');

  if (isMessageEvent && payload.messages && Array.isArray(payload.messages)) {
    for (const message of payload.messages) {
      try {
        const normalized = normalizeWhapiMessage(message);
        await upsertChat(normalized);
        await upsertMessage(normalized);
      } catch (error) {
        const message_error = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('whatsapp-webhook: erro ao processar mensagem', message_error, { messageId: message.id });
      }
    }
  }

  return respond({ success: true, event: eventName, processed: payload.messages?.length || 0 });
});
