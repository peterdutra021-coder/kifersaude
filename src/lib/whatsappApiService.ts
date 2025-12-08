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

export interface MediaContent {
  mimetype?: string;
  data?: string;
  url?: string;
  filename?: string;
  caption?: string;
  preview?: string;
  width?: number;
  height?: number;
  mentions?: string[];
  viewOnce?: boolean;
  seconds?: number;
  waveform?: string;
  autoplay?: boolean;
}

export interface SendMessageParams {
  chatId: string;
  contentType: 'string' | 'image' | 'video' | 'gif' | 'short' | 'audio' | 'voice' | 'document' | 'Location' | 'Contact';
  content: string | MediaContent | {
    latitude?: number;
    longitude?: number;
    description?: string;
    contactId?: string;
  };
  quotedMessageId?: string;
  editMessageId?: string;
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

  if (params.editMessageId) {
    body.edit = params.editMessageId;
  }

  if (params.contentType === 'string') {
    endpoint = '/messages/text';
    body.body = params.content as string;
  } else if (['image', 'video', 'gif', 'short', 'audio', 'voice', 'document'].includes(params.contentType) && typeof params.content === 'object') {
    const media = params.content as MediaContent;

    endpoint = `/messages/${params.contentType}`;

    if (media.url) {
      body.media = media.url;
    } else if (media.data) {
      body.media = `data:${media.mimetype};base64,${media.data}`;
    } else {
      throw new Error('Mídia deve conter URL ou dados base64');
    }

    if (media.mimetype) {
      body.mime_type = media.mimetype;
    }

    if (media.caption) {
      body.caption = media.caption;
    }

    if (media.filename && params.contentType === 'document') {
      body.filename = media.filename;
    }

    if (media.preview) {
      body.preview = media.preview;
    }

    if (media.width) {
      body.width = media.width;
    }

    if (media.height) {
      body.height = media.height;
    }

    if (media.mentions && media.mentions.length > 0) {
      body.mentions = media.mentions;
    }

    if (media.viewOnce !== undefined) {
      body.view_once = media.viewOnce;
    }

    if (media.seconds !== undefined && ['audio', 'voice'].includes(params.contentType)) {
      body.seconds = media.seconds;
    }

    if (media.waveform && params.contentType === 'voice') {
      body.waveform = media.waveform;
    }

    if (media.autoplay !== undefined && params.contentType === 'gif') {
      body.autoplay = media.autoplay;
    }
  } else if (params.contentType === 'Location' && typeof params.content === 'object') {
    endpoint = '/messages/location';
    const location = params.content as { latitude?: number; longitude?: number; description?: string };
    body.latitude = location.latitude;
    body.longitude = location.longitude;
    if (location.description) {
      body.address = location.description;
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

export function detectMediaType(mimetype: string): 'image' | 'video' | 'audio' | 'voice' | 'document' {
  if (mimetype.startsWith('image/')) {
    return 'image';
  } else if (mimetype.startsWith('video/')) {
    return 'video';
  } else if (mimetype.startsWith('audio/')) {
    return 'audio';
  } else {
    return 'document';
  }
}

export async function sendMediaMessage(
  chatId: string,
  file: File,
  options?: {
    caption?: string;
    quotedMessageId?: string;
    viewOnce?: boolean;
    asVoice?: boolean;
  }
) {
  const base64Data = await fileToBase64(file);
  const mimetype = file.type;
  let contentType = detectMediaType(mimetype);

  if (options?.asVoice && mimetype.startsWith('audio/')) {
    contentType = 'voice';
  }

  const mediaContent: MediaContent = {
    mimetype,
    data: base64Data,
    filename: file.name,
    caption: options?.caption,
    viewOnce: options?.viewOnce,
  };

  return sendWhatsAppMessage({
    chatId,
    contentType,
    content: mediaContent,
    quotedMessageId: options?.quotedMessageId,
  });
}
