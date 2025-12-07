import { supabase } from './supabase';

interface WhatsAppSettings {
  api_url: string;
  api_key: string;
  session_id: string;
}

async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('settings')
    .eq('integration_type', 'whatsapp_api')
    .maybeSingle();

  if (error || !data?.settings) {
    throw new Error('WhatsApp API não configurado');
  }

  return data.settings as WhatsAppSettings;
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

  const options: Record<string, unknown> = {};

  if (params.quotedMessageId) {
    options.quotedMessageId = params.quotedMessageId;
  }

  const response = await fetch(
    `${settings.api_url}/client/sendMessage/${settings.session_id}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.api_key,
      },
      body: JSON.stringify({
        chatId: params.chatId,
        contentType: params.contentType,
        content: params.content,
        options: Object.keys(options).length > 0 ? options : undefined,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Erro ao enviar mensagem');
  }

  return response.json();
}

export async function sendTypingState(chatId: string) {
  const settings = await getWhatsAppSettings();

  const response = await fetch(
    `${settings.api_url}/chat/sendStateTyping/${settings.session_id}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.api_key,
      },
      body: JSON.stringify({ chatId }),
    }
  );

  if (!response.ok) {
    throw new Error('Erro ao enviar estado de digitação');
  }

  return response.json();
}

export async function sendRecordingState(chatId: string) {
  const settings = await getWhatsAppSettings();

  const response = await fetch(
    `${settings.api_url}/chat/sendStateRecording/${settings.session_id}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.api_key,
      },
      body: JSON.stringify({ chatId }),
    }
  );

  if (!response.ok) {
    throw new Error('Erro ao enviar estado de gravação');
  }

  return response.json();
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
