import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key, X-Webhook-Event',
};

type StoredEvent = {
  event: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
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

function normalizeJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function extractEventName(payload: any, headers: Headers, url: URL): string {
  const headerEvent = headers.get('x-webhook-event') || headers.get('x-whatsapp-event');
  if (headerEvent && headerEvent.trim()) {
    return headerEvent.trim();
  }

  const queryEvent = url.searchParams.get('event');
  if (queryEvent && queryEvent.trim()) {
    return queryEvent.trim();
  }

  const bodyEvent =
    (typeof payload?.event === 'string' && payload.event) ||
    (typeof payload?.type === 'string' && payload.type) ||
    (typeof payload?.status === 'string' && payload.status);

  if (bodyEvent && bodyEvent.trim()) {
    return bodyEvent.trim();
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

function toIsoString(timestamp: unknown): string | null {
  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

function normalizePayload(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value));
}

function unwrapPayload(payload: Record<string, unknown>): Record<string, unknown> {
  if (payload.message && typeof payload.message === 'object') {
    const messageData = payload.message as Record<string, unknown>;

    const unwrapped = { ...messageData };

    const _data = normalizeJson(messageData._data);
    if (Object.keys(_data).length > 0) {
      unwrapped._data = _data;
    }

    console.log('whatsapp-webhook: payload desencapsulado de "message" wrapper', {
      originalKeys: Object.keys(payload),
      unwrappedKeys: Object.keys(unwrapped),
      hasData: !!unwrapped._data,
    });

    return unwrapped;
  }

  return payload;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

function resolveTimestamp(payload: Record<string, unknown>): number | null {
  const _data = normalizeJson(payload._data);

  const candidates = [
    payload.timestamp,
    (payload as any).t,
    (payload as any).ts,
    _data.t,
    _data.timestamp,
    _data.ts,
    _data.clientReceivedTsMillis,
    (payload as any).clientReceivedTsMillis,
  ];

  for (const candidate of candidates) {
    const numeric = toNumber(candidate);
    if (numeric === null) {
      continue;
    }

    if (numeric > 1_000_000_000_000) {
      return Math.floor(numeric / 1000);
    }

    return numeric;
  }

  return null;
}

function resolveChatId(payload: Record<string, unknown>): string | null {
  const _data = normalizeJson(payload._data);
  const id = normalizeJson(payload.id);

  const candidates = [
    payload.chatId,
    payload.from,
    _data.from,
    id.remote,
    payload.to,
    _data.to,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function resolveContactName(payload: Record<string, unknown>): string | null {
  const sender = normalizeJson(payload.sender);
  const senderId = normalizeJson(sender.id);
  const _data = normalizeJson(payload._data);

  const candidates = [
    payload.notifyName,
    _data.notifyName,
    sender.pushname,
    sender.name,
    sender.shortName,
    sender.formattedName,
    senderId.user,
    payload.chat && normalizeJson((payload as any).chat).name,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function normalizeMessagePayload(payload: Record<string, unknown>): NormalizedMessage | null {
  const messageId = (payload?.id as any)?._serialized || (payload?.id as any)?.id;
  const chatId = resolveChatId(payload);

  console.log('whatsapp-webhook: normalizando payload de mensagem', {
    messageId,
    chatId,
    hasId: !!payload.id,
    idStructure: payload.id ? Object.keys(payload.id as any) : [],
    hasData: !!payload._data,
    from: payload.from,
    to: payload.to,
  });

  if (!messageId || !chatId) {
    console.error('whatsapp-webhook: mensagem sem messageId ou chatId', {
      messageId,
      chatId,
      payloadKeys: Object.keys(payload),
      idObject: payload.id,
    });
    return null;
  }

  const direction: 'inbound' | 'outbound' = payload?.fromMe ? 'outbound' : 'inbound';
  const timestamp = toIsoString(resolveTimestamp(payload));
  const contactName = resolveContactName(payload);
  const chatIdLower = chatId.toLowerCase();
  const isGroup = chatIdLower.endsWith('@g.us') || Boolean((payload as any).isGroup);

  const normalized = {
    chatId,
    messageId,
    direction,
    fromNumber: typeof payload.from === 'string' ? payload.from : null,
    toNumber: typeof payload.to === 'string' ? payload.to : null,
    type: typeof payload.type === 'string' ? payload.type : null,
    body: typeof payload.body === 'string' ? payload.body : null,
    hasMedia: Boolean(payload.hasMedia),
    timestamp,
    contactName,
    isGroup,
    payload: normalizePayload(payload),
  };

  console.log('whatsapp-webhook: mensagem normalizada', {
    messageId: normalized.messageId,
    chatId: normalized.chatId,
    direction: normalized.direction,
    contactName: normalized.contactName,
    body: normalized.body?.substring(0, 50),
  });

  return normalized;
}

async function upsertChat(message: NormalizedMessage) {
  const lastMessageAt = message.timestamp ?? new Date().toISOString();

  const { error } = await supabase.from('whatsapp_chats').upsert(
    {
      id: message.chatId,
      name: message.contactName ?? message.chatId,
      is_group: message.isGroup,
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
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(`Erro ao salvar mensagem: ${error.message}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, { status: 405 });
  }

  let payload: Record<string, unknown> = {};

  try {
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      payload = normalizeJson(await req.json());
    } else {
      const text = await req.text();
      try {
        payload = normalizeJson(JSON.parse(text));
      } catch (_err) {
        payload = { raw: text };
      }
    }
  } catch (error) {
    console.error('whatsapp-webhook: erro ao ler payload', error);
    return respond({ error: 'Payload inválido' }, { status: 400 });
  }

  const headers = extractHeaders(req.headers);
  const eventName = extractEventName(payload, req.headers, url);

  console.log('whatsapp-webhook: evento recebido', {
    eventName,
    payloadKeys: Object.keys(payload),
    hasMessage: !!payload.message,
    url: url.toString(),
  });

  try {
    await storeEvent({ event: eventName, payload, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('whatsapp-webhook: erro ao salvar evento', message, { eventName, payload });
    return respond({ error: message }, { status: 500 });
  }

  const shouldHandleMessage = ['message', 'message_create', 'message_ack'].includes(eventName);

  if (shouldHandleMessage) {
    const unwrapped = unwrapPayload(payload);
    const normalized = normalizeMessagePayload(unwrapped);

    if (!normalized) {
      console.warn('whatsapp-webhook: mensagem ignorada por falta de dados essenciais', { payload, eventName });
    } else {
      try {
        await upsertChat(normalized);
        await upsertMessage(normalized);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('whatsapp-webhook: erro ao salvar mensagem', message, { eventName, payload });
        return respond({ error: message }, { status: 500 });
      }
    }
  }

  return respond({ success: true, event: eventName });
});
