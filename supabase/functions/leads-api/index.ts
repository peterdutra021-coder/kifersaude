import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

function log(message: string, details?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();

  if (details && Object.keys(details).length > 0) {
    console.log(`[leads-api] ${timestamp} - ${message}`, details);
  } else {
    console.log(`[leads-api] ${timestamp} - ${message}`);
  }
}

type LeadLookupMaps = {
  originById: Map<string, string>;
  originByName: Map<string, string>;
  tipoById: Map<string, string>;
  tipoByLabel: Map<string, string>;
  statusById: Map<string, string>;
  statusByName: Map<string, string>;
  defaultStatusId: string | null;
  responsavelById: Map<string, string>;
  responsavelByLabel: Map<string, string>;
};

type AutoContactStep = {
  message: string;
  delaySeconds: number;
  active: boolean;
};

type AutoContactSettings = {
  enabled: boolean;
  baseUrl: string;
  sessionId: string;
  apiKey: string;
  statusOnSend: string;
  messageFlow: AutoContactStep[];
};

type LookupTableRow = { id: string; nome?: string | null; label?: string | null; padrao?: boolean | null };

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function buildLookupMaps({
  origins,
  statuses,
  tipos,
  responsaveis,
}: {
  origins: LookupTableRow[];
  statuses: LookupTableRow[];
  tipos: LookupTableRow[];
  responsaveis: LookupTableRow[];
}): LeadLookupMaps {
  const originById = new Map<string, string>();
  const originByName = new Map<string, string>();
  origins.forEach((origin) => {
    if (origin.id && origin.nome) {
      originById.set(origin.id, origin.nome);
      originByName.set(normalizeText(origin.nome), origin.id);
    }
  });

  const tipoById = new Map<string, string>();
  const tipoByLabel = new Map<string, string>();
  tipos.forEach((tipo) => {
    if (tipo.id && tipo.label) {
      tipoById.set(tipo.id, tipo.label);
      tipoByLabel.set(normalizeText(tipo.label), tipo.id);
    }
  });

  const statusById = new Map<string, string>();
  const statusByName = new Map<string, string>();
  statuses.forEach((status) => {
    if (status.id && status.nome) {
      statusById.set(status.id, status.nome);
      statusByName.set(normalizeText(status.nome), status.id);
    }
  });

  const responsavelById = new Map<string, string>();
  const responsavelByLabel = new Map<string, string>();
  responsaveis.forEach((responsavel) => {
    if (responsavel.id && responsavel.label) {
      responsavelById.set(responsavel.id, responsavel.label);
      responsavelByLabel.set(normalizeText(responsavel.label), responsavel.id);
    }
  });

  const defaultStatusId =
    statuses.find((status) => status.padrao)?.id || statuses.find((status) => status.id)?.id || null;

  return {
    originById,
    originByName,
    tipoById,
    tipoByLabel,
    statusById,
    statusByName,
    defaultStatusId,
    responsavelById,
    responsavelByLabel,
  };
}

async function loadLeadLookupMaps(supabase: ReturnType<typeof createClient>): Promise<LeadLookupMaps> {
  const [origins, statuses, tipos, responsaveis] = await Promise.all([
    supabase.from('lead_origens').select('id, nome'),
    supabase.from('lead_status_config').select('id, nome, padrao'),
    supabase.from('lead_tipos_contratacao').select('id, label'),
    supabase.from('lead_responsaveis').select('id, label'),
  ]);

  const errors = [origins.error, statuses.error, tipos.error, responsaveis.error].filter(Boolean);
  if (errors.length > 0) {
    throw new Error(errors.map((err) => err?.message).join('; '));
  }

  return buildLookupMaps({
    origins: origins.data || [],
    statuses: statuses.data || [],
    tipos: tipos.data || [],
    responsaveis: responsaveis.data || [],
  });
}

function resolveForeignKey(
  idInput: unknown,
  nameInput: unknown,
  idMap: Map<string, string>,
  nameMap: Map<string, string>,
): string | null {
  if (typeof idInput === 'string' && idInput.trim() && idMap.has(idInput.trim())) {
    return idInput.trim();
  }

  if (typeof nameInput === 'string' && nameInput.trim()) {
    const normalized = normalizeText(nameInput);
    return nameMap.get(normalized) ?? null;
  }

  return null;
}

interface LeadData {
  nome_completo: string;
  telefone: string;
  email?: string | null;
  cidade?: string | null;
  regiao?: string | null;
  cep?: string | null;
  endereco?: string | null;
  estado?: string | null;
  origem: string;
  tipo_contratacao: string;
  operadora_atual?: string | null;
  status: string;
  responsavel: string;
  proximo_retorno?: string | null;
  observacoes?: string | null;
  data_criacao: string;
  ultimo_contato: string;
  arquivado: boolean;
}

function parseDateInputToISOString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let normalized = trimmed;
  const hasTime = trimmed.includes('T');
  const timezoneRegex = /(Z|[+-]\d{2}:?\d{2})$/i;

  if (!hasTime) {
    normalized = `${trimmed}T00:00:00`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    normalized = `${trimmed}:00`;
  }

  if (!timezoneRegex.test(normalized)) {
    // Assume horário de Brasília quando o fuso não é informado
    normalized = `${normalized}-03:00`;
  } else if (/^.*[+-]\d{4}$/i.test(normalized)) {
    // Garante que o offset tenha o formato +-HH:MM
    normalized = `${normalized.slice(0, -2)}:${normalized.slice(-2)}`;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function sanitizeOptionalString(value: any): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
}

function validateLeadData(
  data: any,
  lookups: LeadLookupMaps,
): { valid: boolean; errors: string[]; leadData?: LeadData } {
  const errors: string[] = [];

  if (!data.nome_completo || typeof data.nome_completo !== 'string') {
    errors.push('Campo "nome_completo" é obrigatório e deve ser uma string');
  }

  if (!data.telefone || typeof data.telefone !== 'string') {
    errors.push('Campo "telefone" é obrigatório e deve ser uma string');
  }

  const origemId = resolveForeignKey(data.origem_id, data.origem, lookups.originById, lookups.originByName);
  if (!origemId) {
    errors.push('Campo "origem" é obrigatório e deve corresponder a uma origem válida');
  }
  const origemName = origemId ? lookups.originById.get(origemId) : null;

  const tipoContratacaoId = resolveForeignKey(
    data.tipo_contratacao_id,
    data.tipo_contratacao,
    lookups.tipoById,
    lookups.tipoByLabel,
  );
  if (!tipoContratacaoId) {
    errors.push('Campo "tipo_contratacao" é obrigatório e deve corresponder a um tipo de contratação válido');
  }
  const tipoContratacaoLabel = tipoContratacaoId ? lookups.tipoById.get(tipoContratacaoId) : null;

  const responsavelId = resolveForeignKey(
    data.responsavel_id,
    data.responsavel,
    lookups.responsavelById,
    lookups.responsavelByLabel,
  );
  if (!responsavelId) {
    errors.push('Campo "responsavel" é obrigatório e deve corresponder a um responsável válido');
  }
  const responsavelLabel = responsavelId ? lookups.responsavelById.get(responsavelId) : null;

  const statusId =
    resolveForeignKey(data.status_id, data.status, lookups.statusById, lookups.statusByName) ||
    lookups.defaultStatusId;
  if (!statusId) {
    errors.push('Campo "status" é obrigatório e deve corresponder a um status válido');
  }
  const statusName = statusId ? lookups.statusById.get(statusId) : null;

  if (data.email && typeof data.email === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Campo "email" deve ser um endereço de e-mail válido');
    }
  }

  let creationDateIso: string | null = null;
  if (data.data_criacao !== undefined) {
    creationDateIso = parseDateInputToISOString(data.data_criacao);
    if (!creationDateIso) {
      errors.push('Campo "data_criacao" deve ser uma data válida (ISO 8601 ou YYYY-MM-DD)');
    }
  }

  let proximoRetorno: string | null = null;
  if (data.proximo_retorno !== undefined) {
    const parsed = parseDateInputToISOString(data.proximo_retorno);
    if (data.proximo_retorno && !parsed) {
      errors.push('Campo "proximo_retorno" deve ser uma data válida (ISO 8601 ou YYYY-MM-DD)');
    } else {
      proximoRetorno = parsed;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const now = new Date();
  const creationDate = creationDateIso ? new Date(creationDateIso) : now;
  const creationDateIsoValue = creationDate.toISOString();

  const leadData: LeadData = {
    nome_completo: data.nome_completo.trim(),
    telefone: normalizeTelefone(data.telefone),
    email: sanitizeOptionalString(data.email),
    cidade: sanitizeOptionalString(data.cidade),
    regiao: sanitizeOptionalString(data.regiao),
    cep: sanitizeOptionalString(data.cep),
    endereco: sanitizeOptionalString(data.endereco),
    estado: sanitizeOptionalString(data.estado),
    origem: origemName!,
    tipo_contratacao: tipoContratacaoLabel!,
    operadora_atual: sanitizeOptionalString(data.operadora_atual),
    status: statusName!,
    responsavel: responsavelLabel!,
    proximo_retorno: proximoRetorno,
    observacoes: sanitizeOptionalString(data.observacoes),
    data_criacao: creationDateIsoValue,
    ultimo_contato: creationDateIsoValue,
    arquivado: false,
  };

  return { valid: true, errors: [], leadData };
}

function validateLeadUpdate(
  data: any,
  lookups: LeadLookupMaps,
): { valid: boolean; errors: string[]; updateData: Partial<LeadData> } {
  const errors: string[] = [];
  const updateData: Partial<LeadData> = {};

  if (data.nome_completo !== undefined) {
    if (typeof data.nome_completo !== 'string') {
      errors.push('Campo "nome_completo" deve ser uma string');
    } else {
      updateData.nome_completo = data.nome_completo.trim();
    }
  }

  if (data.telefone !== undefined) {
    if (typeof data.telefone !== 'string') {
      errors.push('Campo "telefone" deve ser uma string');
    } else {
      updateData.telefone = normalizeTelefone(data.telefone);
    }
  }

  if (data.email !== undefined) {
    const email = sanitizeOptionalString(data.email);
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push('Campo "email" deve ser um endereço de e-mail válido');
      }
    }
    updateData.email = email;
  }

  if (data.cidade !== undefined) updateData.cidade = sanitizeOptionalString(data.cidade);
  if (data.regiao !== undefined) updateData.regiao = sanitizeOptionalString(data.regiao);
  if (data.cep !== undefined) updateData.cep = sanitizeOptionalString(data.cep);
  if (data.endereco !== undefined) updateData.endereco = sanitizeOptionalString(data.endereco);
  if (data.estado !== undefined) updateData.estado = sanitizeOptionalString(data.estado);
  if (data.operadora_atual !== undefined) updateData.operadora_atual = sanitizeOptionalString(data.operadora_atual);
  if (data.proximo_retorno !== undefined) {
    const parsed = parseDateInputToISOString(data.proximo_retorno);
    if (data.proximo_retorno && !parsed) {
      errors.push('Campo "proximo_retorno" deve ser uma data válida (ISO 8601 ou YYYY-MM-DD)');
    } else {
      updateData.proximo_retorno = parsed;
    }
  }
  if (data.observacoes !== undefined) updateData.observacoes = sanitizeOptionalString(data.observacoes);

  if (data.origem_id !== undefined || data.origem !== undefined) {
    const origemId = resolveForeignKey(data.origem_id, data.origem, lookups.originById, lookups.originByName);
    if (!origemId) {
      errors.push('Campo "origem" deve corresponder a uma origem válida');
    } else {
      const origemName = lookups.originById.get(origemId);
      if (origemName) {
        updateData.origem = origemName;
      }
    }
  }

  if (data.tipo_contratacao_id !== undefined || data.tipo_contratacao !== undefined) {
    const tipoId = resolveForeignKey(
      data.tipo_contratacao_id,
      data.tipo_contratacao,
      lookups.tipoById,
      lookups.tipoByLabel,
    );
    if (!tipoId) {
      errors.push('Campo "tipo_contratacao" deve corresponder a um tipo de contratação válido');
    } else {
      const tipoLabel = lookups.tipoById.get(tipoId);
      if (tipoLabel) {
        updateData.tipo_contratacao = tipoLabel;
      }
    }
  }

  if (data.responsavel_id !== undefined || data.responsavel !== undefined) {
    const responsavelId = resolveForeignKey(
      data.responsavel_id,
      data.responsavel,
      lookups.responsavelById,
      lookups.responsavelByLabel,
    );
    if (!responsavelId) {
      errors.push('Campo "responsavel" deve corresponder a um responsável válido');
    } else {
      const responsavelLabel = lookups.responsavelById.get(responsavelId);
      if (responsavelLabel) {
        updateData.responsavel = responsavelLabel;
      }
    }
  }

  if (data.status_id !== undefined || data.status !== undefined) {
    const statusId = resolveForeignKey(data.status_id, data.status, lookups.statusById, lookups.statusByName);
    if (!statusId) {
      errors.push('Campo "status" deve corresponder a um status válido');
    } else {
      const statusName = lookups.statusById.get(statusId);
      if (statusName) {
        updateData.status = statusName;
      }
    }
  }

  if (data.data_criacao !== undefined) {
    const parsedDate = parseDateInputToISOString(data.data_criacao);
    if (!parsedDate) {
      errors.push('Campo "data_criacao" deve ser uma data válida (ISO 8601 ou YYYY-MM-DD)');
    } else {
      updateData.data_criacao = parsedDate;
    }
  }

  return { valid: errors.length === 0, errors, updateData };
}

function resolveFilterId(
  value: string | null,
  idMap: Map<string, string>,
  nameMap: Map<string, string>,
): string | null {
  if (!value) return null;
  if (idMap.has(value)) return value;
  return nameMap.get(normalizeText(value)) ?? null;
}

function mapLeadRelationsForResponse(lead: any, lookups: LeadLookupMaps) {
  return {
    ...lead,
    origem: lead.origem ?? (lead.origem_id ? lookups.originById.get(lead.origem_id) ?? null : null),
    tipo_contratacao:
      lead.tipo_contratacao ?? (lead.tipo_contratacao_id ? lookups.tipoById.get(lead.tipo_contratacao_id) ?? null : null),
    status: lead.status ?? (lead.status_id ? lookups.statusById.get(lead.status_id) ?? null : null),
    responsavel:
      lead.responsavel ?? (lead.responsavel_id ? lookups.responsavelById.get(lead.responsavel_id) ?? null : null),
  };
}

function getDuplicateStatusId(lookups: LeadLookupMaps) {
  return lookups.statusByName.get(normalizeText('Duplicado')) ?? null;
}

async function isDuplicateLead(
  supabase: ReturnType<typeof createClient>,
  telefone: string,
  email?: string | null,
): Promise<boolean> {
  const filters = [telefone ? `telefone.eq.${telefone}` : null, email ? `email.ilike.${email.toLowerCase()}` : null].filter(
    Boolean,
  );

  if (filters.length === 0) return false;

  const { data, error } = await supabase.from('leads').select('id').or(filters.join(',')).limit(1);

  if (error) {
    console.error('Erro ao verificar duplicidade de lead', error);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

function normalizeTelefone(telefone: string): string {
  return telefone.replace(/\D/g, '');
}

async function sendWhatsappMessages({
  endpoint,
  apiKey,
  chatId,
  messages,
}: {
  endpoint: string;
  apiKey: string;
  chatId: string;
  messages: string[];
}): Promise<void> {
  for (const content of messages) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        chatId,
        contentType: 'string',
        content,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Falha ao enviar mensagem automática');
    }
  }
}

const normalizeAutoContactSettings = (settings: any): AutoContactSettings | null => {
  if (!settings || typeof settings !== 'object') return null;

  const messageFlow: AutoContactStep[] = Array.isArray(settings.messageFlow)
    ? settings.messageFlow.map((step: any, index: number) => ({
        message: typeof step?.message === 'string' ? step.message : '',
        delaySeconds:
          Number.isFinite(step?.delaySeconds)
            ? Math.max(0, Number(step.delaySeconds))
            : Number.isFinite(step?.delayMinutes)
              ? Math.max(0, Number(step.delayMinutes) * 60)
              : 0,
        active: step?.active !== false,
      }))
    : [];

  return {
    enabled: settings.enabled !== false,
    baseUrl:
      typeof settings.baseUrl === 'string' && settings.baseUrl.trim()
        ? settings.baseUrl.trim()
        : 'http://localhost:3000',
    sessionId:
      typeof settings.sessionId === 'string' && settings.sessionId.trim() ? settings.sessionId.trim() : '',
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey : '',
    statusOnSend:
      typeof settings.statusOnSend === 'string' && settings.statusOnSend.trim()
        ? settings.statusOnSend.trim()
        : 'Contato Inicial',
    messageFlow,
  };
};

const applyTemplateVariables = (template: string, lead: any) => {
  const firstName = lead?.nome_completo?.trim()?.split(/\s+/)?.[0] ?? '';

  return template
    .replace(/{{\s*nome\s*}}/gi, lead?.nome_completo || '')
    .replace(/{{\s*primeiro_nome\s*}}/gi, firstName)
    .replace(/{{\s*origem\s*}}/gi, lead?.origem || '')
    .replace(/{{\s*cidade\s*}}/gi, lead?.cidade || '')
    .replace(/{{\s*responsavel\s*}}/gi, lead?.responsavel || '');
};

async function loadAutoContactSettings(
  supabase: ReturnType<typeof createClient>,
): Promise<AutoContactSettings | null> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('settings')
    .eq('slug', 'whatsapp_auto_contact')
    .maybeSingle();

  if (error) {
    console.warn('Erro ao carregar integração de mensagens automáticas', error);
    return null;
  }

  return normalizeAutoContactSettings(data?.settings) ?? null;
}

async function triggerAutoContactForLead({
  supabase,
  lead,
  lookups,
  logWithContext,
}: {
  supabase: ReturnType<typeof createClient>;
  lead: any;
  lookups: LeadLookupMaps;
  logWithContext: (message: string, details?: Record<string, unknown>) => void;
}): Promise<void> {
  const settings = await loadAutoContactSettings(supabase);
  if (!settings || !settings.enabled) {
    logWithContext('Integração de auto contato desativada ou não configurada');
    return;
  }

  const activeSteps = settings.messageFlow
    .filter((step) => step.active && step.message.trim())
    .sort((a, b) => a.delaySeconds - b.delaySeconds);

  const firstStep = activeSteps[0];
  if (!firstStep) {
    logWithContext('Fluxo de mensagens automáticas sem etapas ativas');
    return;
  }

  const normalizedPhone = normalizeTelefone(lead?.telefone || '');
  if (!normalizedPhone) {
    logWithContext('Lead sem telefone válido para automação', { leadId: lead?.id });
    return;
  }

  if (!settings.sessionId) {
    logWithContext('Integração de automação sem Session ID configurado');
    return;
  }

  const message = applyTemplateVariables(firstStep.message, lead);

  try {
    const url = `${settings.baseUrl.replace(/\/+$/, '')}/client/sendMessage/${settings.sessionId}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
      },
      body: JSON.stringify({
        chatId: `55${normalizedPhone}@c.us`,
        contentType: 'string',
        content: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Falha ao enviar automação para o lead');
    }

    logWithContext('Mensagem automática enviada', { leadId: lead.id });

    const targetStatusName = settings.statusOnSend?.trim();
    const normalizedTarget = targetStatusName ? normalizeText(targetStatusName) : null;
    const targetStatusId = normalizedTarget
      ? lookups.statusByName.get(normalizedTarget) ?? lookups.defaultStatusId
      : lookups.defaultStatusId;

    const now = new Date().toISOString();

    await supabase.from('interactions').insert([
      {
        lead_id: lead.id,
        tipo: 'Mensagem Automática',
        descricao: 'Fluxo automático disparado pela API de leads',
        responsavel: lead.responsavel,
      },
    ]);

    if (targetStatusId) {
      await supabase
        .from('leads')
        .update({
          status_id: targetStatusId,
          ultimo_contato: now,
        })
        .eq('id', lead.id);
    } else {
      await supabase
        .from('leads')
        .update({ ultimo_contato: now })
        .eq('id', lead.id);
    }
  } catch (error) {
    console.error('Erro ao disparar automação para o lead', { leadId: lead?.id, error });
  }
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const logWithContext = (message: string, details?: Record<string, unknown>) =>
    log(message, { requestId, ...details });

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const path = url.pathname;
    const action = url.searchParams.get('action') ?? req.headers.get('x-action');

    logWithContext('Request received', { method: req.method, path, search: url.search || undefined });

    let lookupMaps: LeadLookupMaps | null = null;
    const getLookups = async () => {
      if (!lookupMaps) {
        logWithContext('Loading lookup tables');
        lookupMaps = await loadLeadLookupMaps(supabase);
        logWithContext('Lookup tables loaded', {
          origins: lookupMaps.originById.size,
          statuses: lookupMaps.statusById.size,
          tipos: lookupMaps.tipoById.size,
          responsaveis: lookupMaps.responsavelById.size,
        });
      }
      return lookupMaps;
    };

    if (action === 'manual-automation' && req.method === 'POST') {
      const body = await req.json().catch(() => null);

      if (!body || typeof body.chatId !== 'string' || !Array.isArray(body.messages)) {
        return new Response(JSON.stringify({ success: false, error: 'Payload inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const chatId = body.chatId.trim();
      const messages = body.messages
        .filter((msg: unknown) => typeof msg === 'string' && msg.trim())
        .map((msg: string) => msg.trim());

      if (!chatId || messages.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'Dados incompletos para envio manual' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const settings = await loadAutoContactSettings(supabase);

      if (!settings || !settings.baseUrl || !settings.sessionId) {
        return new Response(
          JSON.stringify({ success: false, error: 'Integração de mensagens automáticas não configurada' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const endpoint = `${settings.baseUrl.replace(/\/+$/, '')}/client/sendMessage/${settings.sessionId}`;

      try {
        await sendWhatsappMessages({ endpoint, apiKey: settings.apiKey, chatId, messages });
        logWithContext('Envio manual de automação concluído', { chatId });

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Erro ao enviar automação manual', error);
        const message = error instanceof Error ? error.message : 'Falha ao enviar automação manual';
        return new Response(JSON.stringify({ success: false, error: message }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (path.endsWith('/health')) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          service: 'leads-api',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (path.endsWith('/leads') && req.method === 'POST') {
      const body = await req.json();
      const lookups = await getLookups();
      const validation = validateLeadData(body, lookups);

      if (!validation.valid || !validation.leadData) {
        logWithContext('Lead creation validation failed', { errors: validation.errors });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Dados inválidos',
            details: validation.errors,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const duplicateStatusId = getDuplicateStatusId(lookups);
      const duplicateLead = await isDuplicateLead(
        supabase,
        validation.leadData.telefone,
        validation.leadData.email ?? null,
      );

      if (duplicateLead) {
        validation.leadData.status_id = duplicateStatusId ?? validation.leadData.status_id;
        validation.leadData.status = 'Duplicado';
      }

      const { data, error } = await supabase
        .from('leads')
        .insert([validation.leadData])
        .select()
        .single();

      if (error) {
        console.error('Erro ao inserir lead:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao criar lead',
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      logWithContext('Lead created successfully', { leadId: data.id });

      try {
        await triggerAutoContactForLead({
          supabase,
          lead: data,
          lookups,
          logWithContext,
        });
      } catch (automationError) {
        console.error('Falha ao processar automação após criação do lead', automationError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Lead criado com sucesso',
          data: mapLeadRelationsForResponse(data, lookups),
        }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (path.endsWith('/leads') && req.method === 'GET') {
      const lookups = await getLookups();
      const searchParams = url.searchParams;
      const status = searchParams.get('status_id') || searchParams.get('status');
      const responsavel = searchParams.get('responsavel_id') || searchParams.get('responsavel');
      const origem = searchParams.get('origem_id') || searchParams.get('origem');
      const tipoContratacao = searchParams.get('tipo_contratacao_id') || searchParams.get('tipo_contratacao');
      const telefone = searchParams.get('telefone');
      const email = searchParams.get('email');
      const parsedLimit = parseInt(searchParams.get('limit') || '100', 10);
      const limit = Number.isNaN(parsedLimit) ? 100 : parsedLimit;

      const statusId = resolveFilterId(status, lookups.statusById, lookups.statusByName);
      const responsavelId = resolveFilterId(
        responsavel,
        lookups.responsavelById,
        lookups.responsavelByLabel,
      );
      const origemId = resolveFilterId(origem, lookups.originById, lookups.originByName);
      const tipoContratacaoId = resolveFilterId(
        tipoContratacao,
        lookups.tipoById,
        lookups.tipoByLabel,
      );

      const invalidFilters: string[] = [];
      if (status && !statusId) invalidFilters.push('status');
      if (responsavel && !responsavelId) invalidFilters.push('responsavel');
      if (origem && !origemId) invalidFilters.push('origem');
      if (tipoContratacao && !tipoContratacaoId) invalidFilters.push('tipo_contratacao');

      if (invalidFilters.length > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Filtros inválidos',
            details: invalidFilters.map((field) => `Valor de filtro inválido para "${field}"`),
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      logWithContext('Listing leads', {
        filters: { statusId, responsavelId, origemId, tipoContratacaoId, telefone: telefone ? normalizeTelefone(telefone) : null, email },
        limit,
      });

      let query = supabase
        .from('leads')
        .select('*')
        .eq('arquivado', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (statusId) query = query.eq('status_id', statusId);
      if (responsavelId) query = query.eq('responsavel_id', responsavelId);
      if (origemId) query = query.eq('origem_id', origemId);
      if (tipoContratacaoId) query = query.eq('tipo_contratacao_id', tipoContratacaoId);
      if (telefone) query = query.eq('telefone', normalizeTelefone(telefone));
      if (email) query = query.ilike('email', email);

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar leads:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao buscar leads',
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const leads = (data || []).map((lead) => mapLeadRelationsForResponse(lead, lookups));

      logWithContext('Lead search completed', { count: leads.length });

      return new Response(
        JSON.stringify({
          success: true,
          count: leads.length,
          data: leads,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (path.match(/\/leads\/[a-f0-9-]+$/) && req.method === 'PUT') {
      const leadId = path.split('/').pop();
      const body = await req.json();
      const lookups = await getLookups();
      const validation = validateLeadUpdate(body, lookups);

      if (!validation.valid) {
        logWithContext('Lead update validation failed', { leadId, errors: validation.errors });
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Dados inválidos',
            details: validation.errors,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const { data, error } = await supabase
        .from('leads')
        .update(validation.updateData)
        .eq('id', leadId)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar lead:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao atualizar lead',
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      logWithContext('Lead updated successfully', { leadId });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Lead atualizado com sucesso',
          data: mapLeadRelationsForResponse(data, lookups),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (path.endsWith('/leads/batch') && req.method === 'POST') {
      const body = await req.json();
      const lookups = await getLookups();

      if (!Array.isArray(body.leads)) {
        logWithContext('Batch lead creation failed: leads is not array');
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Campo "leads" deve ser um array',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const results = {
        success: [],
        failed: [],
      };

      for (const [index, leadInput] of body.leads.entries()) {
        const validation = validateLeadData(leadInput, lookups);

        if (!validation.valid || !validation.leadData) {
          results.failed.push({
            index,
            data: leadInput,
            errors: validation.errors,
          });
          continue;
        }

        const duplicateStatusId = getDuplicateStatusId(lookups);
        const duplicateLead = await isDuplicateLead(
          supabase,
          validation.leadData.telefone,
          validation.leadData.email ?? null,
        );

        if (duplicateLead) {
          validation.leadData.status_id = duplicateStatusId ?? validation.leadData.status_id;
          validation.leadData.status = 'Duplicado';
        }

        const { data, error } = await supabase
          .from('leads')
          .insert([validation.leadData])
          .select()
          .single();

        if (error) {
          results.failed.push({
            index,
            data: leadInput,
            error: error.message,
          });
        } else {
          results.success.push({
            index,
            data: mapLeadRelationsForResponse(data, lookups),
          });
        }
      }

      logWithContext('Batch lead creation summary', {
        total: body.leads.length,
        success: results.success.length,
        failed: results.failed.length,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `Processados ${body.leads.length} leads: ${results.success.length} sucesso, ${results.failed.length} falhas`,
          results,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Endpoint não encontrado',
        message: 'Rotas disponíveis: POST /leads, GET /leads, PUT /leads/:id, POST /leads/batch, GET /health',
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    logWithContext('Erro interno', { error: error instanceof Error ? error.message : String(error) });
    console.error('Erro interno:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro interno do servidor',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});