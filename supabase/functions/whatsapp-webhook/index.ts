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
  status?: string;
  edited_at?: number;
  edit_history?: Array<{
    body: string;
    timestamp: number;
  }>;
  text?: {
    body: string;
  };
  from?: string;
  from_name?: string;
  image?: {
    mime_type: string;
    file_size: number;
    link?: string;
    caption?: string;
  };
  video?: {
    mime_type: string;
    file_size: number;
    link?: string;
    caption?: string;
  };
  audio?: {
    mime_type: string;
    file_size: number;
    link?: string;
  };
  voice?: {
    mime_type: string;
    file_size: number;
    link?: string;
  };
  document?: {
    mime_type: string;
    file_size: number;
    link?: string;
    filename?: string;
    caption?: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  live_location?: {
    latitude: number;
    longitude: number;
    caption?: string;
  };
  contact?: {
    name: string;
    vcard: string;
  };
  contact_list?: {
    list: Array<{
      name: string;
      vcard: string;
    }>;
  };
  link_preview?: {
    body: string;
    url: string;
    title?: string;
    description?: string;
  };
  sticker?: {
    mime_type: string;
    link?: string;
    animated?: boolean;
  };
  action?: {
    target: string;
    type: string;
    emoji?: string;
    votes?: string[];
  };
  context?: {
    quoted_id?: string;
    quoted_author?: string;
    quoted_type?: string;
    quoted_content?: Record<string, unknown>;
  };
  reply?: {
    type: string;
    buttons_reply?: {
      id: string;
      title: string;
    };
  };
  group_invite?: {
    body: string;
    url: string;
    invite_code: string;
  };
  poll?: {
    title: string;
    options: string[];
    total: number;
  };
  product?: {
    product_id: string;
    catalog_id: string;
  };
  order?: {
    order_id: string;
    status: string;
    item_count: number;
  };
};

type WhapiStatus = {
  id: string;
  code: number;
  status: string;
  recipient_id: string;
  timestamp: string;
};

type WhapiParticipant = {
  id: string;
  rank: 'creator' | 'admin' | 'member';
};

type WhapiGroup = {
  id: string;
  name: string;
  type: string;
  timestamp?: number;
  participants: WhapiParticipant[];
  name_at?: number;
  created_at: number;
  created_by: string;
  chat_pic?: string;
  chat_pic_full?: string;
  adminAddMemberMode?: boolean;
};

type WhapiGroupParticipants = {
  group_id: string;
  participants: string[];
  action: 'add' | 'remove' | 'promote' | 'demote' | 'request';
};

type WhapiGroupUpdate = {
  before_update: WhapiGroup;
  after_update: WhapiGroup;
  changes: string[];
};

type WhapiWebhook = {
  messages?: WhapiMessage[];
  statuses?: WhapiStatus[];
  groups?: WhapiGroup[];
  groups_participants?: WhapiGroupParticipants[];
  groups_updates?: WhapiGroupUpdate[];
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
  } else if (message.link_preview) {
    body = message.link_preview.body;
    hasMedia = true;
  } else if (message.image) {
    body = message.image.caption || '[Imagem]';
    hasMedia = true;
  } else if (message.video) {
    body = message.video.caption || '[Vídeo]';
    hasMedia = true;
  } else if (message.audio) {
    body = '[Áudio]';
    hasMedia = true;
  } else if (message.voice) {
    body = '[Mensagem de voz]';
    hasMedia = true;
  } else if (message.document) {
    const fileName = message.document.filename || '';
    const caption = message.document.caption;
    body = caption ? `${caption} [Documento: ${fileName}]` : `[Documento${fileName ? ': ' + fileName : ''}]`;
    hasMedia = true;
  } else if (message.location) {
    body = `[Localização${message.location.address ? ': ' + message.location.address : ''}]`;
    hasMedia = true;
  } else if (message.live_location) {
    body = `[Localização ao vivo${message.live_location.caption ? ': ' + message.live_location.caption : ''}]`;
    hasMedia = true;
  } else if (message.contact) {
    body = `[Contato: ${message.contact.name}]`;
  } else if (message.contact_list) {
    const count = message.contact_list.list.length;
    body = `[${count} contato${count > 1 ? 's' : ''}]`;
  } else if (message.sticker) {
    body = message.sticker.animated ? '[Sticker animado]' : '[Sticker]';
    hasMedia = true;
  } else if (message.action) {
    if (message.action.type === 'reaction') {
      body = `Reagiu com ${message.action.emoji || ''}`;
    } else if (message.action.type === 'delete') {
      body = '[Mensagem apagada]';
    } else if (message.action.type === 'vote') {
      body = '[Votou em enquete]';
    } else {
      body = `[Ação: ${message.action.type}]`;
    }
  } else if (message.reply?.buttons_reply) {
    body = `Resposta: ${message.reply.buttons_reply.title}`;
  } else if (message.group_invite) {
    body = `[Convite para grupo: ${message.group_invite.url}]`;
  } else if (message.poll) {
    body = `[Enquete: ${message.poll.title}]`;
  } else if (message.product) {
    body = '[Produto do catálogo]';
  } else if (message.order) {
    body = `[Pedido #${message.order.order_id}]`;
  } else {
    body = `[${message.type}]`;
  }

  const fromNumber = direction === 'inbound' ? (message.from || chatId) : null;
  const toNumber = direction === 'outbound' ? chatId : null;
  const contactName = message.from_name || null;
  const timestamp = toIsoString(message.timestamp);

  const ackStatus = message.status ? mapStatusToAck(message.status) : null;

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
    ackStatus,
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

function mapStatusToAck(status: string): number {
  const statusMap: Record<string, number> = {
    'failed': 0,
    'pending': 1,
    'sent': 2,
    'delivered': 3,
    'read': 4,
    'played': 4,
  };
  return statusMap[status] ?? 1;
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

  const { data: existingChat } = await supabase
    .from('whatsapp_chats')
    .select('name')
    .eq('id', message.chatId)
    .maybeSingle();

  if (existingChat?.name) {
    return existingChat.name;
  }

  if (message.direction === 'inbound' && message.contactName) {
    return message.contactName;
  }

  return phoneNumber;
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
      original_body: message.body,
      has_media: message.hasMedia,
      timestamp: message.timestamp,
      payload: message.payload,
      direction: message.direction,
      author: message.author,
      ack_status: message.ackStatus,
      is_deleted: false,
      edit_count: 0,
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

async function processMessageEdit(message: WhapiMessage, normalized: NormalizedMessage) {
  console.log('whatsapp-webhook: processando edição de mensagem', {
    messageId: message.id,
    chatId: message.chat_id,
    editedAt: message.edited_at,
  });

  const { data: existingMessage, error: fetchError } = await supabase
    .from('whatsapp_messages')
    .select('body, original_body, edit_count, payload')
    .eq('id', message.id)
    .maybeSingle();

  if (fetchError) {
    console.error('whatsapp-webhook: erro ao buscar mensagem existente', fetchError);
    return;
  }

  if (!existingMessage) {
    console.log('whatsapp-webhook: mensagem não existe ainda, salvando como nova');
    await upsertMessage(normalized);
    return;
  }

  const oldBody = existingMessage.body;
  const newBody = normalized.body;
  const editCount = (existingMessage.edit_count || 0) + 1;
  const originalBody = existingMessage.original_body || existingMessage.body;

  const { error: updateError } = await supabase
    .from('whatsapp_messages')
    .update({
      body: newBody,
      original_body: originalBody,
      edit_count: editCount,
      edited_at: message.edited_at ? toIsoString(message.edited_at) : new Date().toISOString(),
      payload: normalized.payload,
    })
    .eq('id', message.id);

  if (updateError) {
    console.error('whatsapp-webhook: erro ao atualizar mensagem editada', updateError);
    return;
  }

  console.log('whatsapp-webhook: mensagem editada com sucesso', {
    messageId: message.id,
    editCount,
    oldBodyLength: oldBody?.length || 0,
    newBodyLength: newBody?.length || 0,
  });
}

async function processMessageDelete(message: WhapiMessage) {
  console.log('whatsapp-webhook: processando deleção de mensagem', {
    messageId: message.id,
    chatId: message.chat_id,
  });

  const { data: existingMessage, error: fetchError } = await supabase
    .from('whatsapp_messages')
    .select('body, payload')
    .eq('id', message.id)
    .maybeSingle();

  if (fetchError) {
    console.error('whatsapp-webhook: erro ao buscar mensagem para deletar', fetchError);
    return;
  }

  if (!existingMessage) {
    console.log('whatsapp-webhook: mensagem não encontrada para deleção', { messageId: message.id });
    return;
  }

  const deletedBy = message.from_me ? 'outbound_user' : (message.from || 'unknown');

  const { error: updateError } = await supabase
    .from('whatsapp_messages')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy,
      payload: JSON.parse(JSON.stringify(message)),
    })
    .eq('id', message.id);

  if (updateError) {
    console.error('whatsapp-webhook: erro ao marcar mensagem como deletada', updateError);
    return;
  }

  console.log('whatsapp-webhook: mensagem marcada como deletada', {
    messageId: message.id,
    deletedBy,
  });
}

async function processGroupCreation(group: WhapiGroup) {
  console.log('whatsapp-webhook: processando criação de grupo', {
    groupId: group.id,
    groupName: group.name,
    participantsCount: group.participants.length,
  });

  const { error: groupError } = await supabase.from('whatsapp_groups').upsert(
    {
      id: group.id,
      name: group.name,
      type: group.type,
      chat_pic: group.chat_pic || null,
      chat_pic_full: group.chat_pic_full || null,
      created_at: toIsoString(group.created_at),
      created_by: group.created_by,
      name_at: group.name_at ? toIsoString(group.name_at) : null,
      admin_add_member_mode: group.adminAddMemberMode ?? true,
      first_seen_at: new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (groupError) {
    throw new Error(`Erro ao salvar grupo: ${groupError.message}`);
  }

  for (const participant of group.participants) {
    const { error: participantError } = await supabase.from('whatsapp_group_participants').upsert(
      {
        group_id: group.id,
        phone: participant.id,
        rank: participant.rank,
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'group_id,phone' },
    );

    if (participantError) {
      console.error('whatsapp-webhook: erro ao salvar participante', {
        groupId: group.id,
        phone: participant.id,
        error: participantError.message,
      });
    }
  }

  const { error: eventError } = await supabase.from('whatsapp_group_events').insert({
    group_id: group.id,
    event_type: 'created',
    participants: group.participants.map((p) => p.id),
    triggered_by: group.created_by,
    occurred_at: toIsoString(group.created_at),
    created_at: new Date().toISOString(),
  });

  if (eventError) {
    console.error('whatsapp-webhook: erro ao salvar evento de criação do grupo', eventError.message);
  }

  await supabase.from('whatsapp_chats').upsert(
    {
      id: group.id,
      name: group.name,
      is_group: true,
      phone_number: null,
      lid: null,
      last_message_at: toIsoString(group.created_at),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
}

async function processGroupParticipantChange(change: WhapiGroupParticipants) {
  console.log('whatsapp-webhook: processando mudança de participantes', {
    groupId: change.group_id,
    action: change.action,
    participantsCount: change.participants.length,
  });

  const eventTypeMap: Record<string, string> = {
    add: 'participant_added',
    remove: 'participant_removed',
    promote: 'participant_promoted',
    demote: 'participant_demoted',
    request: 'join_request',
  };

  const eventType = eventTypeMap[change.action] || change.action;

  if (change.action === 'add') {
    for (const phone of change.participants) {
      const { error } = await supabase.from('whatsapp_group_participants').upsert(
        {
          group_id: change.group_id,
          phone,
          rank: 'member',
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'group_id,phone' },
      );

      if (error) {
        console.error('whatsapp-webhook: erro ao adicionar participante', {
          groupId: change.group_id,
          phone,
          error: error.message,
        });
      }
    }
  } else if (change.action === 'remove') {
    for (const phone of change.participants) {
      const { error } = await supabase
        .from('whatsapp_group_participants')
        .delete()
        .eq('group_id', change.group_id)
        .eq('phone', phone);

      if (error) {
        console.error('whatsapp-webhook: erro ao remover participante', {
          groupId: change.group_id,
          phone,
          error: error.message,
        });
      }
    }
  } else if (change.action === 'promote') {
    for (const phone of change.participants) {
      const { error } = await supabase
        .from('whatsapp_group_participants')
        .update({ rank: 'admin', updated_at: new Date().toISOString() })
        .eq('group_id', change.group_id)
        .eq('phone', phone);

      if (error) {
        console.error('whatsapp-webhook: erro ao promover participante', {
          groupId: change.group_id,
          phone,
          error: error.message,
        });
      }
    }
  } else if (change.action === 'demote') {
    for (const phone of change.participants) {
      const { error } = await supabase
        .from('whatsapp_group_participants')
        .update({ rank: 'member', updated_at: new Date().toISOString() })
        .eq('group_id', change.group_id)
        .eq('phone', phone);

      if (error) {
        console.error('whatsapp-webhook: erro ao rebaixar participante', {
          groupId: change.group_id,
          phone,
          error: error.message,
        });
      }
    }
  }

  const { error: eventError } = await supabase.from('whatsapp_group_events').insert({
    group_id: change.group_id,
    event_type: eventType,
    participants: change.participants,
    occurred_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });

  if (eventError) {
    console.error('whatsapp-webhook: erro ao salvar evento de participante', eventError.message);
  }
}

async function processGroupUpdate(update: WhapiGroupUpdate) {
  console.log('whatsapp-webhook: processando atualização de grupo', {
    groupId: update.after_update.id,
    changes: update.changes,
  });

  const updateData: Record<string, unknown> = {
    last_updated_at: new Date().toISOString(),
  };

  let eventType: string | null = null;
  let oldValue: string | null = null;
  let newValue: string | null = null;

  for (const change of update.changes) {
    if (change === 'name') {
      updateData.name = update.after_update.name;
      updateData.name_at = update.after_update.name_at
        ? toIsoString(update.after_update.name_at)
        : new Date().toISOString();
      eventType = 'name_changed';
      oldValue = update.before_update.name;
      newValue = update.after_update.name;
    } else if (change === 'chat_pic' || change === 'chat_pic_full') {
      updateData.chat_pic = update.after_update.chat_pic || null;
      updateData.chat_pic_full = update.after_update.chat_pic_full || null;
      if (!eventType) {
        eventType = 'picture_changed';
        oldValue = update.before_update.chat_pic || 'sem foto';
        newValue = update.after_update.chat_pic || 'sem foto';
      }
    }
  }

  const { error: groupError } = await supabase
    .from('whatsapp_groups')
    .update(updateData)
    .eq('id', update.after_update.id);

  if (groupError) {
    throw new Error(`Erro ao atualizar grupo: ${groupError.message}`);
  }

  if (eventType && updateData.name) {
    await supabase
      .from('whatsapp_chats')
      .update({ name: updateData.name, updated_at: new Date().toISOString() })
      .eq('id', update.after_update.id);
  }

  if (eventType) {
    const { error: eventError } = await supabase.from('whatsapp_group_events').insert({
      group_id: update.after_update.id,
      event_type: eventType,
      old_value: oldValue,
      new_value: newValue,
      occurred_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });

    if (eventError) {
      console.error('whatsapp-webhook: erro ao salvar evento de atualização do grupo', eventError.message);
    }
  }
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
  const isStatusEvent = eventName.toLowerCase().includes('statuses');
  const isGroupEvent = eventName.toLowerCase().includes('groups');

  if (isMessageEvent && payload.messages && Array.isArray(payload.messages)) {
    for (const message of payload.messages) {
      try {
        const isDeleted = message.action?.type === 'delete' || message.type === 'revoked';
        const isEdited = message.edited_at !== undefined || message.edit_history !== undefined;

        if (isDeleted) {
          console.log('whatsapp-webhook: mensagem deletada detectada', {
            messageId: message.id,
            chatId: message.chat_id,
          });
          await processMessageDelete(message);
        } else {
          const normalized = normalizeWhapiMessage(message);
          await upsertChat(normalized);

          if (isEdited) {
            console.log('whatsapp-webhook: mensagem editada detectada', {
              messageId: message.id,
              chatId: message.chat_id,
              editedAt: message.edited_at,
            });
            await processMessageEdit(message, normalized);
          } else {
            await upsertMessage(normalized);
          }
        }
      } catch (error) {
        const message_error = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('whatsapp-webhook: erro ao processar mensagem', message_error, { messageId: message.id });
      }
    }
  }

  if (isStatusEvent && payload.statuses && Array.isArray(payload.statuses)) {
    for (const status of payload.statuses) {
      try {
        const ackStatus = status.code;
        await updateMessageAck(status.id, ackStatus);
        console.log('whatsapp-webhook: status de mensagem atualizado', {
          messageId: status.id,
          status: status.status,
          ackStatus,
        });
      } catch (error) {
        const status_error = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('whatsapp-webhook: erro ao processar status', status_error, { statusId: status.id });
      }
    }
  }

  if (isGroupEvent) {
    if (payload.groups && Array.isArray(payload.groups)) {
      for (const group of payload.groups) {
        try {
          await processGroupCreation(group);
          console.log('whatsapp-webhook: grupo criado/atualizado', {
            groupId: group.id,
            groupName: group.name,
          });
        } catch (error) {
          const group_error = error instanceof Error ? error.message : 'Erro desconhecido';
          console.error('whatsapp-webhook: erro ao processar grupo', group_error, { groupId: group.id });
        }
      }
    }

    if (payload.groups_participants && Array.isArray(payload.groups_participants)) {
      for (const change of payload.groups_participants) {
        try {
          await processGroupParticipantChange(change);
          console.log('whatsapp-webhook: participantes do grupo atualizados', {
            groupId: change.group_id,
            action: change.action,
            participants: change.participants,
          });
        } catch (error) {
          const participant_error = error instanceof Error ? error.message : 'Erro desconhecido';
          console.error('whatsapp-webhook: erro ao processar participantes', participant_error, {
            groupId: change.group_id,
          });
        }
      }
    }

    if (payload.groups_updates && Array.isArray(payload.groups_updates)) {
      for (const update of payload.groups_updates) {
        try {
          await processGroupUpdate(update);
          console.log('whatsapp-webhook: grupo atualizado', {
            groupId: update.after_update.id,
            changes: update.changes,
          });
        } catch (error) {
          const update_error = error instanceof Error ? error.message : 'Erro desconhecido';
          console.error('whatsapp-webhook: erro ao processar atualização de grupo', update_error, {
            groupId: update.after_update.id,
          });
        }
      }
    }
  }

  const processed =
    (payload.messages?.length || 0) +
    (payload.statuses?.length || 0) +
    (payload.groups?.length || 0) +
    (payload.groups_participants?.length || 0) +
    (payload.groups_updates?.length || 0);
  return respond({ success: true, event: eventName, processed });
});