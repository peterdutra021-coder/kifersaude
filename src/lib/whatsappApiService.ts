import { supabase } from './supabase';

interface WhatsAppSettings {
  token: string;
  enabled?: boolean;
}

const WHAPI_BASE_URL = 'https://gate.whapi.cloud';

async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('settings')
    .eq('slug', 'whatsapp_auto_contact')
    .maybeSingle();

  if (error || !data?.settings) {
    throw new Error('WhatsApp API não configurado');
  }

  const settings = data.settings as WhatsAppSettings;

  if (!settings.token) {
    throw new Error('Token da Whapi Cloud não configurado. Verifique as configurações em Automação do WhatsApp.');
  }

  return settings;
}

export interface SendMessageParams {
  chatId: string;
  contentType: 'string' | 'MessageMedia' | 'MessageMediaFromURL' | 'Location' | 'Contact';
  content: string | {
    mimetype?: string;
    data?: string;
    filename?: string;
    latitude?: number;
    longitude?: number;
    description?: string;
    contactId?: string;
  };
  quotedMessageId?: string;
}

export async function sendWhatsAppMessage(params: SendMessageParams) {
  const settings = await getWhatsAppSettings();

  let endpoint = '';
  let body: Record<string, unknown> = {
    to: params.chatId,
  };

  if (params.quotedMessageId) {
    body.quoted = params.quotedMessageId;
  }

  if (params.contentType === 'string') {
    endpoint = '/messages/text';
    body.body = params.content as string;
  } else if (params.contentType === 'MessageMedia' && typeof params.content === 'object') {
    const media = params.content;
    if (media.mimetype?.startsWith('image/')) {
      endpoint = '/messages/image';
      body.media = `data:${media.mimetype};base64,${media.data}`;
      if (media.filename) {
        body.caption = media.filename;
      }
    } else if (media.mimetype?.startsWith('video/')) {
      endpoint = '/messages/video';
      body.media = `data:${media.mimetype};base64,${media.data}`;
      if (media.filename) {
        body.caption = media.filename;
      }
    } else if (media.mimetype?.startsWith('audio/')) {
      endpoint = '/messages/audio';
      body.media = `data:${media.mimetype};base64,${media.data}`;
    } else {
      endpoint = '/messages/document';
      body.media = `data:${media.mimetype};base64,${media.data}`;
      if (media.filename) {
        body.filename = media.filename;
      }
    }
  } else if (params.contentType === 'Location' && typeof params.content === 'object') {
    endpoint = '/messages/location';
    body.latitude = params.content.latitude;
    body.longitude = params.content.longitude;
    if (params.content.description) {
      body.address = params.content.description;
    }
  } else {
    throw new Error('Tipo de conteúdo não suportado');
  }

  const response = await fetch(`${WHAPI_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.token}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(error.error || error.message || 'Erro ao enviar mensagem');
  }

  return response.json();
}

export async function sendTypingState(chatId: string) {
  const settings = await getWhatsAppSettings();

  const response = await fetch(`${WHAPI_BASE_URL}/chats/${chatId}/typing`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.token}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify({ typing: true }),
  });

  if (!response.ok) {
    console.error('Erro ao enviar estado de digitação');
  }

  return response.ok;
}

export async function sendRecordingState(chatId: string) {
  const settings = await getWhatsAppSettings();

  const response = await fetch(`${WHAPI_BASE_URL}/chats/${chatId}/recording`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.token}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify({ recording: true }),
  });

  if (!response.ok) {
    console.error('Erro ao enviar estado de gravação');
  }

  return response.ok;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = error => reject(error);
  });
}
