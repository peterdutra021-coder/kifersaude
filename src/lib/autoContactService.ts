import { Lead } from './supabase';

export const AUTO_CONTACT_INTEGRATION_SLUG = 'whatsapp_auto_contact';

export type AutoContactStep = {
  id: string;
  message: string;
  delaySeconds: number;
  active: boolean;
};

export type AutoContactSettings = {
  enabled: boolean;
  baseUrl: string;
  sessionId: string;
  apiKey: string;
  statusOnSend: string;
  messageFlow: AutoContactStep[];
};

const DEFAULT_STATUS = 'Contato Inicial';
const DEFAULT_BASE_URL = 'http://localhost:3000';
const DEFAULT_SESSION_ID = '';

export const DEFAULT_MESSAGE_FLOW: AutoContactStep[] = [
  {
    id: 'step-1',
    message:
      'Oi {{primeiro_nome}}, tudo bem? Sou a Luiza Kifer, especialista em planos de saúde, e vi que você demonstrou interesse em receber uma cotação.',
    delaySeconds: 0,
    active: true,
  },
  {
    id: 'step-2',
    message:
      'Será que você tem um minutinho pra conversarmos? Quero entender melhor o que você está buscando no plano de saúde 😊',
    delaySeconds: 120,
    active: true,
  },
];

const getNormalizedDelaySeconds = (step: any) => {
  const delaySeconds = Number.isFinite(step?.delaySeconds) ? Number(step.delaySeconds) : null;
  const delayMinutes = Number.isFinite(step?.delayMinutes) ? Number(step.delayMinutes) : null;

  const normalizedSeconds = delaySeconds ?? (delayMinutes !== null ? delayMinutes * 60 : null);

  return normalizedSeconds !== null ? Math.max(0, normalizedSeconds) : 0;
};

export const normalizeAutoContactSettings = (rawSettings: Record<string, any> | null | undefined): AutoContactSettings => {
  const settings = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  const messageFlow = Array.isArray(settings.messageFlow)
    ? settings.messageFlow.map((step, index) => ({
        id: typeof step?.id === 'string' && step.id.trim() ? step.id : `step-${index}`,
        message: typeof step?.message === 'string' ? step.message : '',
        delaySeconds: getNormalizedDelaySeconds(step),
        active: step?.active !== false,
      }))
    : [];

  return {
    enabled: settings.enabled !== false,
    baseUrl: typeof settings.baseUrl === 'string' && settings.baseUrl.trim() ? settings.baseUrl.trim() : DEFAULT_BASE_URL,
    sessionId:
      typeof settings.sessionId === 'string' && settings.sessionId.trim() ? settings.sessionId.trim() : DEFAULT_SESSION_ID,
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
    statusOnSend:
      typeof settings.statusOnSend === 'string' && settings.statusOnSend.trim()
        ? settings.statusOnSend.trim()
        : DEFAULT_STATUS,
    messageFlow,
  };
};

export const applyTemplateVariables = (template: string, lead: Lead) => {
  const firstName = lead.nome_completo?.trim().split(/\s+/)[0] ?? '';

  return template
    .replace(/{{\s*nome\s*}}/gi, lead.nome_completo || '')
    .replace(/{{\s*primeiro_nome\s*}}/gi, firstName)
    .replace(/{{\s*origem\s*}}/gi, lead.origem || '')
    .replace(/{{\s*cidade\s*}}/gi, lead.cidade || '')
    .replace(/{{\s*responsavel\s*}}/gi, lead.responsavel || '');
};

const waitSeconds = (seconds: number) => new Promise((resolve) => setTimeout(resolve, Math.max(0, seconds) * 1000));

const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

const buildEndpoint = (baseUrl: string, path: string) => {
  const sanitizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${sanitizedBase}${path.startsWith('/') ? '' : '/'}${path}`;
};

export async function sendAutoContactMessage({
  lead,
  message,
  settings,
}: {
  lead: Lead;
  message: string;
  settings: AutoContactSettings;
}): Promise<void> {
  const normalizedPhone = normalizePhone(lead.telefone || '');
  if (!normalizedPhone) {
    throw new Error('Telefone inválido para envio automático.');
  }

  if (!settings.sessionId) {
    throw new Error('Session ID não configurado na integração de mensagens automáticas.');
  }

  const chatId = `55${normalizedPhone}@c.us`;
  const payload = {
    chatId,
    contentType: 'string' as const,
    content: message,
  };

  const endpoint = buildEndpoint(settings.baseUrl, `/client/sendMessage/${settings.sessionId}`);

  console.info('[AutoContact] Enviando automação', {
    endpoint,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.apiKey,
    },
    payload,
    leadId: lead.id,
    normalizedPhone,
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const messageDetail = errorText?.trim()
        ? `${response.status} ${response.statusText}: ${errorText}`
        : `${response.status} ${response.statusText}`;
      throw new Error(`Falha ao enviar mensagem automática (${messageDetail})`);
    }
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error('Erro ao enviar mensagem automática para', endpoint, payload, error);
    throw new Error(details);
  }
}

export async function runAutoContactFlow({
  lead,
  settings,
  signal,
  onFirstMessageSent,
}: {
  lead: Lead;
  settings: AutoContactSettings;
  signal?: () => boolean;
  onFirstMessageSent?: () => Promise<void> | void;
}): Promise<void> {
  const steps = settings.messageFlow
    .filter((step) => step.active && step.message.trim())
    .sort((a, b) => a.delaySeconds - b.delaySeconds);

  if (steps.length === 0) return;

  let firstMessageHandled = false;

  for (const step of steps) {
    if (signal?.() === false) break;
    if (step.delaySeconds > 0) {
      await waitSeconds(step.delaySeconds);
    }

    if (signal?.() === false) break;

    const finalMessage = applyTemplateVariables(step.message, lead);
    await sendAutoContactMessage({ lead, message: finalMessage, settings });

    if (!firstMessageHandled) {
      firstMessageHandled = true;
      await onFirstMessageSent?.();
    }
  }
}
