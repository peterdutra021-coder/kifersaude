import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const INTEGRATION_SLUG = 'facebook_ads_manager';

const DEFAULT_SETTINGS = {
  defaultOrigem: 'tráfego pago',
  defaultTipoContratacao: 'Pessoa Física',
  defaultResponsavel: 'Luiza',
};

type IntegrationSettings = {
  pageAccessToken?: string;
  verifyToken?: string;
  defaultOrigem?: string;
  defaultTipoContratacao?: string;
  defaultResponsavel?: string;
};

type FacebookLeadField = {
  name?: string;
  values?: unknown[];
};

type FacebookLeadPayload = {
  id?: string;
  created_time?: string;
  field_data?: FacebookLeadField[];
  ad_id?: string;
  adset_id?: string;
  adgroup_id?: string;
  campaign_id?: string;
  form_id?: string;
};

type LeadRecord = {
  nome_completo: string;
  telefone: string;
  email?: string | null;
  cidade?: string | null;
  regiao?: string | null;
  origem: string;
  tipo_contratacao: string;
  operadora_atual?: string | null;
  status?: string;
  responsavel: string;
  proximo_retorno?: string | null;
  observacoes?: string | null;
  data_criacao: string;
  ultimo_contato: string;
  arquivado: boolean;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch (_err) {
    return 'Erro desconhecido';
  }
}

function normalizePhone(value?: string | null): string {
  if (!value || typeof value !== 'string') return '';
  return value.replace(/\D/g, '');
}

async function applyDuplicateStatus(
  supabase: ReturnType<typeof createClient>,
  lead: LeadRecord,
): Promise<LeadRecord> {
  const filters = [lead.telefone ? `telefone.eq.${lead.telefone}` : null, lead.email ? `email.ilike.${lead.email.toLowerCase()}` : null].filter(
    Boolean,
  );

  if (filters.length === 0) return lead;

  const { data: duplicates, error: duplicateError } = await supabase
    .from('leads')
    .select('id')
    .or(filters.join(','))
    .limit(1);

  if (duplicateError) {
    console.error('Erro ao verificar duplicidade de lead do Facebook', duplicateError);
    return lead;
  }

  if (!duplicates?.length) return lead;

  const { data: duplicateStatus, error: duplicateStatusError } = await supabase
    .from('lead_status_config')
    .select('id')
    .eq('nome', 'Duplicado')
    .maybeSingle();

  if (duplicateStatusError) {
    console.error('Erro ao buscar status Duplicado para lead do Facebook', duplicateStatusError);
  }

  return { ...lead, status: 'Duplicado' };
}

function getFieldValue(fieldData: FacebookLeadField[] | undefined, keys: string[]): string | undefined {
  if (!fieldData?.length) return undefined;

  const normalizedKeys = keys.map(key => key.trim().toLowerCase());

  for (const field of fieldData) {
    if (!field?.name) continue;

    const fieldName = field.name.trim().toLowerCase();
    if (!normalizedKeys.includes(fieldName)) continue;

    const values = Array.isArray(field.values) ? field.values : [];
    const firstValue = values.find(value => typeof value === 'string');
    if (typeof firstValue === 'string') {
      return firstValue.trim();
    }
  }

  return undefined;
}

async function loadIntegrationSettings() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await supabase
    .from('integration_settings')
    .select('settings')
    .eq('slug', INTEGRATION_SLUG)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao carregar configurações da integração: ${error.message}`);
  }

  return (data?.settings as IntegrationSettings | null) ?? null;
}

async function fetchLeadDetails(leadId: string, pageAccessToken: string): Promise<FacebookLeadPayload | null> {
  const url = `https://graph.facebook.com/v20.0/${leadId}?access_token=${encodeURIComponent(pageAccessToken)}`;

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    const text = await response.text();
    console.error(`Erro ao buscar lead ${leadId}:`, text);
    return null;
  }

  const payload = (await response.json()) as FacebookLeadPayload;
  return payload;
}

function buildLeadRecord(payload: FacebookLeadPayload, settings: IntegrationSettings): LeadRecord | null {
  const fieldData = payload.field_data;

  const nome =
    getFieldValue(fieldData, ['full_name', 'nome', 'nome_completo']) ||
    [getFieldValue(fieldData, ['first_name']), getFieldValue(fieldData, ['last_name'])]
      .filter(Boolean)
      .join(' ')
      .trim();

  const telefone = normalizePhone(
    getFieldValue(fieldData, ['phone_number', 'telefone', 'celular']) || getFieldValue(fieldData, ['phone'])
  );

  if (!telefone) {
    console.warn(`Lead ${payload.id} ignorado: sem telefone.`);
    return null;
  }

  const createdAt = payload.created_time ? new Date(payload.created_time).toISOString() : new Date().toISOString();
  const origem = settings.defaultOrigem?.trim() || DEFAULT_SETTINGS.defaultOrigem;
  const tipoContratacao = settings.defaultTipoContratacao?.trim() || DEFAULT_SETTINGS.defaultTipoContratacao;
  const responsavel = settings.defaultResponsavel?.trim() || DEFAULT_SETTINGS.defaultResponsavel;

  const observacoesParts = [
    `Lead do Facebook Form ${payload.form_id ?? 'desconhecido'}`,
    payload.campaign_id ? `Campanha: ${payload.campaign_id}` : null,
    payload.adset_id ? `Conjunto: ${payload.adset_id}` : null,
    payload.adgroup_id && !payload.adset_id ? `Conjunto: ${payload.adgroup_id}` : null,
    payload.ad_id ? `Anúncio: ${payload.ad_id}` : null,
  ].filter(Boolean);

  return {
    nome_completo: nome || 'Lead do Facebook',
    telefone,
    email: getFieldValue(fieldData, ['email']) || null,
    cidade: getFieldValue(fieldData, ['city', 'cidade']) || null,
    regiao: getFieldValue(fieldData, ['state', 'estado', 'regiao']) || null,
    origem,
    tipo_contratacao: tipoContratacao,
    operadora_atual: getFieldValue(fieldData, ['operadora', 'plano_atual']) || null,
    status: 'Novo',
    responsavel,
    proximo_retorno: null,
    observacoes: observacoesParts.join(' | ') || null,
    data_criacao: createdAt,
    ultimo_contato: createdAt,
    arquivado: false,
  };
}

async function storeLead(supabaseUrl: string, serviceRoleKey: string, lead: LeadRecord) {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const leadWithDuplicateStatus = await applyDuplicateStatus(supabase, lead);

  const { data, error } = await supabase.from('leads').insert([leadWithDuplicateStatus]).select().single();
  if (error) {
    throw new Error(`Erro ao salvar lead no CRM: ${error.message}`);
  }

  return data;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`facebook-leads-webhook: received ${req.method} request`, {
    url: req.url,
    headers: {
      'user-agent': req.headers.get('user-agent'),
      'content-type': req.headers.get('content-type'),
    },
  });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Supabase não configurado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const settings = (await loadIntegrationSettings()) ?? DEFAULT_SETTINGS;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('facebook-leads-webhook: GET verification', {
        mode,
        hasToken: Boolean(token),
        hasChallenge: Boolean(challenge),
      });

      if (mode === 'subscribe' && token && token === settings.verifyToken) {
        return new Response(challenge ?? '', { status: 200, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ error: 'Token de verificação inválido.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método não suportado.' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!settings.pageAccessToken) {
      return new Response(
        JSON.stringify({ error: 'Configure o token de acesso da página do Facebook antes de ativar o webhook.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const entries = Array.isArray(body?.entry) ? body.entry : [];

    console.log('facebook-leads-webhook: POST payload received', {
      entriesCount: entries.length,
    });

    const results = [] as { leadId: string; status: 'success' | 'skipped' | 'error'; message?: string }[];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];

      for (const change of changes) {
        const leadId = change?.value?.leadgen_id || change?.value?.lead_id;
        if (!leadId) continue;

        console.log('facebook-leads-webhook: processing lead', { leadId });

        const leadPayload = await fetchLeadDetails(String(leadId), settings.pageAccessToken!);
        if (!leadPayload) {
          results.push({ leadId: String(leadId), status: 'error', message: 'Não foi possível buscar detalhes do lead.' });
          continue;
        }

        const leadRecord = buildLeadRecord(leadPayload, settings);
        if (!leadRecord) {
          results.push({ leadId: String(leadId), status: 'skipped', message: 'Lead sem telefone válido.' });
          console.log('facebook-leads-webhook: lead skipped due to missing phone', { leadId });
          continue;
        }

        try {
          await storeLead(supabaseUrl, serviceRoleKey, leadRecord);
          console.log('facebook-leads-webhook: lead stored successfully', { leadId });
          results.push({ leadId: String(leadId), status: 'success' });
        } catch (error) {
          console.error('Erro ao salvar lead do Facebook:', error);
          results.push({ leadId: String(leadId), status: 'error', message: getErrorMessage(error) });
        }
      }
    }

    return new Response(JSON.stringify({ received: entries.length, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Erro geral na função facebook-leads-webhook:', error);
    return new Response(JSON.stringify({ error: 'Erro interno', details: getErrorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
