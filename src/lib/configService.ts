import type { PostgrestError } from '@supabase/supabase-js';

import {
  supabase,
  SystemSettings,
  Operadora,
  ProdutoPlano,
  LeadStatusConfig,
  LeadOrigem,
  ConfigOption,
  ProfilePermission,
  IntegrationSetting,
} from './supabase';

export type ConfigCategory =
  | 'lead_tipo_contratacao'
  | 'lead_responsavel'
  | 'contract_status'
  | 'contract_modalidade'
  | 'contract_abrangencia'
  | 'contract_acomodacao'
  | 'contract_carencia';

type RawConfigOption = Partial<ConfigOption> & {
  id: string;
  label: string;
  value?: string | null;
  description?: string | null;
  ordem?: number | null;
  ativo?: boolean | null;
  active?: boolean | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
  category?: string | null;
};

const normalizeConfigOption = (category: ConfigCategory, option: RawConfigOption): ConfigOption => {
  const fallbackValue =
    typeof option.value === 'string' && option.value.length > 0 ? option.value : (option.label ?? '');

  const normalizedLabel =
    typeof option.label === 'string' && option.label.length > 0
      ? option.label
      : typeof fallbackValue === 'string' && fallbackValue.length > 0
        ? fallbackValue
        : '';

  const normalizedOrdem = typeof option.ordem === 'number' && Number.isFinite(option.ordem) ? option.ordem : 0;
  const ativoValue = option?.ativo ?? option?.active;
  const metadata =
    option?.metadata && isRecord(option.metadata) ? (option.metadata as Record<string, any>) : null;

  const createdAt = option?.created_at ?? new Date().toISOString();
  const updatedAt = option?.updated_at ?? createdAt;

  return {
    id: option.id,
    category: option.category ?? category,
    label: normalizedLabel,
    value: typeof fallbackValue === 'string' && fallbackValue.length > 0 ? fallbackValue : normalizedLabel,
    description: option.description ?? null,
    ordem: normalizedOrdem,
    ativo: ativoValue === undefined || ativoValue === null ? true : Boolean(ativoValue),
    metadata,
    created_at: createdAt,
    updated_at: updatedAt,
  };
};

const CONFIG_CATEGORY_TABLE_MAP: Record<ConfigCategory, string> = {
  lead_tipo_contratacao: 'lead_tipos_contratacao',
  lead_responsavel: 'lead_responsaveis',
  contract_status: 'contract_status_config',
  contract_modalidade: 'contract_modalidades',
  contract_abrangencia: 'contract_abrangencias',
  contract_acomodacao: 'contract_acomodacoes',
  contract_carencia: 'contract_carencias',
};

const fetchLegacyConfigOptions = async (category: ConfigCategory): Promise<ConfigOption[]> => {
  try {
    const baseQuery = () =>
      supabase
        .from('system_configurations')
        .select('*')
        .eq('category', category);

    let { data, error } = await baseQuery().order('ordem', { ascending: true }).order('label', { ascending: true });

    if (error && isMissingColumnError(error, 'ordem')) {
      ({ data, error } = await baseQuery().order('label', { ascending: true }));
    }

    if (error && isMissingColumnError(error, 'label')) {
      ({ data, error } = await baseQuery());
    }

    if (error) throw error;
    return (data || []).map(option => normalizeConfigOption(category, option as RawConfigOption));
  } catch (error) {
    console.error('Error loading config options:', error);
    return [];
  }
};

const createLegacyConfigOption = async (
  category: ConfigCategory,
  option: { label: string; value?: string; description?: string; ordem?: number; ativo?: boolean; metadata?: Record<string, any> },
): Promise<{ data: ConfigOption | null; error: any }> => {
  try {
    const basePayload: Record<string, any> = {
      category,
      label: option.label,
      value: option.value || option.label,
      description: option.description || null,
      ordem: option.ordem ?? 0,
      metadata: option.metadata || null,
    };
    const ativoValue = option.ativo ?? true;

    const insert = async (payload: Record<string, any>) =>
      supabase.from('system_configurations').insert([payload]).select().single();

    let payload: Record<string, any> = { ...basePayload, ativo: ativoValue };
    let { data, error } = await insert(payload);
    const triedColumns = new Set<string>();

    while (error) {
      if (isMissingColumnError(error, 'ativo') && !triedColumns.has('ativo')) {
        triedColumns.add('ativo');
        const { ativo, ...rest } = payload;
        payload = { ...rest, active: ativo ?? ativoValue };
      } else if (isMissingColumnError(error, 'active') && !triedColumns.has('active')) {
        triedColumns.add('active');
        const { active: _omitActive, ...rest } = payload;
        payload = rest;
      } else if (isMissingColumnError(error, 'metadata') && !triedColumns.has('metadata')) {
        triedColumns.add('metadata');
        const { metadata: _omitMetadata, ...rest } = payload;
        payload = rest;
      } else if (isMissingColumnError(error, 'description') && !triedColumns.has('description')) {
        triedColumns.add('description');
        const { description: _omitDescription, ...rest } = payload;
        payload = rest;
      } else if (isMissingColumnError(error, 'ordem') && !triedColumns.has('ordem')) {
        triedColumns.add('ordem');
        const { ordem: _omitOrdem, ...rest } = payload;
        payload = rest;
      } else if (isMissingColumnError(error, 'value') && !triedColumns.has('value')) {
        triedColumns.add('value');
        const { value: _omitValue, ...rest } = payload;
        payload = rest;
      } else if (isMissingColumnError(error, 'label') || isMissingColumnError(error, 'category')) {
        break;
      } else {
        break;
      }

      ({ data, error } = await insert(payload));
    }

    if (error) {
      return { data: null, error: toPostgrestError(error) };
    }

    return { data: data ? normalizeConfigOption(category, data as RawConfigOption) : null, error: null };
  } catch (error) {
    console.error('Error creating config option:', error);
    return { data: null, error: toPostgrestError(error) };
  }
};

const updateLegacyConfigOption = async (
  id: string,
  updates: Partial<Pick<ConfigOption, 'label' | 'value' | 'description' | 'ordem' | 'ativo' | 'metadata'>>,
): Promise<{ error: any }> => {
  try {
    const { ativo, ...rest } = updates;
    const timestamp = new Date().toISOString();
    let payload: Record<string, any> = { ...rest, updated_at: timestamp };

    if (ativo !== undefined) {
      payload.ativo = ativo;
    }

    const performUpdate = (data: Record<string, any>) =>
      supabase.from('system_configurations').update(data).eq('id', id);

    let { error } = await performUpdate(payload);
    const triedColumns = new Set<string>();

    while (error) {
      if (ativo !== undefined && isMissingColumnError(error, 'ativo') && !triedColumns.has('ativo')) {
        triedColumns.add('ativo');
        const { ativo: _omitAtivo, ...restPayload } = payload;
        payload = { ...restPayload, active: ativo };
      } else if (ativo !== undefined && isMissingColumnError(error, 'active') && !triedColumns.has('active')) {
        triedColumns.add('active');
        const { active: _omitActive, ...restPayload } = payload;
        payload = restPayload;
      } else if (isMissingColumnError(error, 'metadata') && !triedColumns.has('metadata')) {
        triedColumns.add('metadata');
        const { metadata: _omitMetadata, ...restPayload } = payload;
        payload = restPayload;
      } else if (isMissingColumnError(error, 'description') && !triedColumns.has('description')) {
        triedColumns.add('description');
        const { description: _omitDescription, ...restPayload } = payload;
        payload = restPayload;
      } else if (isMissingColumnError(error, 'ordem') && !triedColumns.has('ordem')) {
        triedColumns.add('ordem');
        const { ordem: _omitOrdem, ...restPayload } = payload;
        payload = restPayload;
      } else if (isMissingColumnError(error, 'value') && !triedColumns.has('value')) {
        triedColumns.add('value');
        const { value: _omitValue, ...restPayload } = payload;
        payload = restPayload;
      } else {
        break;
      }

      ({ error } = await performUpdate(payload));
    }

    return { error: error ? toPostgrestError(error) : null };
  } catch (error) {
    console.error('Error updating config option:', error);
    return { error: toPostgrestError(error) };
  }
};

const deleteLegacyConfigOption = async (id: string): Promise<{ error: any }> => {
  try {
    const { error } = await supabase
      .from('system_configurations')
      .delete()
      .eq('id', id);

    return { error: error ? toPostgrestError(error) : null };
  } catch (error) {
    console.error('Error deleting config option:', error);
    return { error: toPostgrestError(error) };
  }
};

const isMissingColumnError = (error: PostgrestError | null | undefined, column: string) => {
  if (!error) return false;
  const normalizedCode = typeof error.code === 'string' ? error.code.toUpperCase() : '';
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const normalizedMessage = message.replace(/"/g, "'");
  const columnLower = column.toLowerCase();
  return (
    (normalizedCode === 'PGRST204' || normalizedCode === '42703') &&
    (normalizedMessage.includes(`'${columnLower}'`) || normalizedMessage.includes(columnLower))
  );
};

const isColumnTypeError = (error: PostgrestError | null | undefined, column: string) => {
  if (!error) return false;
  const normalizedCode = typeof error.code === 'string' ? error.code.toUpperCase() : '';
  if (!['22P02', '42804', '23502', '22007', '42883'].includes(normalizedCode)) {
    return false;
  }

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const normalizedMessage = message.replace(/"/g, "'");
  const columnLower = column.toLowerCase();

  return normalizedMessage.includes(`'${columnLower}'`) || normalizedMessage.includes(columnLower);
};

const PROFILE_PERMISSIONS_TABLE = 'profile_permissions';

const isTableMissingError = (error: unknown, table: string) => {
  if (!error || typeof error !== 'object') return false;
  const { code, message, details, hint } = error as PostgrestError;
  const normalizedCode = typeof code === 'string' ? code.toUpperCase() : '';
  const tableLower = table.toLowerCase();
  const normalizedMessage = typeof message === 'string' ? message.toLowerCase() : '';
  const normalizedDetails = typeof details === 'string' ? details.toLowerCase() : '';
  const normalizedHint = typeof hint === 'string' ? hint.toLowerCase() : '';

  if (normalizedCode === 'PGRST302' || normalizedCode === 'PGRST301' || normalizedCode === '42P01') return true;

  return (
    normalizedMessage.includes(`resource ${tableLower}`) ||
    normalizedMessage.includes(`relation "${tableLower}`) ||
    normalizedMessage.includes(`relation '${tableLower}`) ||
    normalizedMessage.includes('does not exist') ||
    normalizedMessage.includes(tableLower) ||
    normalizedDetails.includes(tableLower) ||
    normalizedHint.includes(tableLower)
  );
};

const toPostgrestError = (error: unknown): PostgrestError => {
  if (error && typeof error === 'object' && 'message' in error && 'code' in error) {
    return error as PostgrestError;
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return {
    message,
    details: '',
    hint: '',
    code: 'UNKNOWN',
    name: 'Error',
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeIntegrationSetting = (row: IntegrationSetting): IntegrationSetting => {
  const settings = isRecord(row.settings) ? (row.settings as Record<string, any>) : {};
  return { ...row, settings };
};

const LOCAL_INTEGRATIONS_KEY = 'integration_settings_fallback';

const canUseLocalStorage = () => typeof window !== 'undefined' && !!window.localStorage;

const loadLocalIntegrations = (): IntegrationSetting[] => {
  if (!canUseLocalStorage()) return [];

  const raw = window.localStorage.getItem(LOCAL_INTEGRATIONS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeIntegrationSetting(item as IntegrationSetting))
      .filter((item) => typeof item.slug === 'string' && item.slug.trim());
  } catch (error) {
    console.warn('Unable to parse local integration settings', error);
    return [];
  }
};

const persistLocalIntegrations = (items: IntegrationSetting[]) => {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(LOCAL_INTEGRATIONS_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('Unable to persist local integration settings', error);
  }
};

const storeLocalIntegrationSetting = (integration: IntegrationSetting): IntegrationSetting => {
  const normalized = normalizeIntegrationSetting(integration);
  const list = loadLocalIntegrations();
  const index = list.findIndex((item) => item.slug === normalized.slug || item.id === normalized.id);

  if (index >= 0) {
    list[index] = { ...list[index], ...normalized };
  } else {
    list.push(normalized);
  }

  persistLocalIntegrations(list);
  return normalized;
};

const getLocalIntegrationSetting = (slug: string): IntegrationSetting | null => {
  const list = loadLocalIntegrations();
  return list.find((item) => item.slug === slug) ?? null;
};

const createLocalIntegrationSetting = (
  payload: Pick<IntegrationSetting, 'slug' | 'name'> & Partial<Pick<IntegrationSetting, 'description' | 'settings'>>,
): IntegrationSetting => {
  const now = new Date().toISOString();
  const integration: IntegrationSetting = {
    id: `local-${payload.slug}`,
    slug: payload.slug,
    name: payload.name,
    description: payload.description ?? null,
    settings: payload.settings ?? {},
    created_at: now,
    updated_at: now,
  };

  return storeLocalIntegrationSetting(integration);
};

const updateLocalIntegrationSetting = (
  id: string,
  updates: Partial<Pick<IntegrationSetting, 'name' | 'description' | 'settings'>>,
): IntegrationSetting | null => {
  const existing = loadLocalIntegrations();
  const index = existing.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const updated = normalizeIntegrationSetting({ ...existing[index], ...updates, updated_at: now } as IntegrationSetting);
  existing[index] = updated;
  persistLocalIntegrations(existing);
  return updated;
};

export const configService = {
  async getSystemSettings(): Promise<SystemSettings | null> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error loading system settings:', error);
      return null;
    }
  },

  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<{ error: any }> {
    try {
      const { data: existing } = await supabase
        .from('system_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (!existing) {
        return { error: new Error('System settings not found') };
      }

      const { error } = await supabase
        .from('system_settings')
        .update({ ...settings, updated_at: new Date().toISOString() })
        .eq('id', existing.id);

      return { error };
    } catch (error) {
      console.error('Error updating system settings:', error);
      return { error };
    }
  },

  async getOperadoras(): Promise<Operadora[]> {
    try {
      const { data, error } = await supabase
        .from('operadoras')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading operadoras:', error);
      return [];
    }
  },

  async createOperadora(operadora: Omit<Operadora, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Operadora | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('operadoras')
        .insert([operadora])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error creating operadora:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateOperadora(id: string, updates: Partial<Operadora>): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('operadoras')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      return { error: toPostgrestError(error) };
    } catch (error) {
      console.error('Error updating operadora:', error);
      return { error };
    }
  },

  async deleteOperadora(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('operadoras')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error deleting operadora:', error);
      return { error };
    }
  },

  async getProdutosPlanos(): Promise<ProdutoPlano[]> {
    try {
      const { data, error } = await supabase
        .from('produtos_planos')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading produtos:', error);
      return [];
    }
  },

  async createProdutoPlano(produto: Omit<ProdutoPlano, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: ProdutoPlano | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('produtos_planos')
        .insert([produto])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error creating produto:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateProdutoPlano(id: string, updates: Partial<ProdutoPlano>): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('produtos_planos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      return { error: toPostgrestError(error) };
    } catch (error) {
      console.error('Error updating produto:', error);
      return { error };
    }
  },

  async deleteProdutoPlano(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('produtos_planos')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error deleting produto:', error);
      return { error };
    }
  },

  async getLeadStatusConfig(): Promise<LeadStatusConfig[]> {
    try {
      const { data, error } = await supabase
        .from('lead_status_config')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading status config:', error);
      return [];
    }
  },

  async createLeadStatus(status: Omit<LeadStatusConfig, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: LeadStatusConfig | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('lead_status_config')
        .insert([status])
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error creating status:', error);
      return { data: null, error };
    }
  },

  async updateLeadStatus(id: string, updates: Partial<LeadStatusConfig>): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('lead_status_config')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error updating status:', error);
      return { error };
    }
  },

  async deleteLeadStatus(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('lead_status_config')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error deleting status:', error);
      return { error };
    }
  },

  async getLeadOrigens(): Promise<LeadOrigem[]> {
    try {
      const { data, error } = await supabase
        .from('lead_origens')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return (data || []).map((origem) => ({
        ...origem,
        visivel_para_observadores:
          typeof origem.visivel_para_observadores === 'boolean'
            ? origem.visivel_para_observadores
            : true,
      }));
    } catch (error) {
      console.error('Error loading origens:', error);
      return [];
    }
  },

  async createLeadOrigem(origem: Omit<LeadOrigem, 'id' | 'created_at'>): Promise<{ data: LeadOrigem | null; error: any }> {
    try {
      const payload = {
        ...origem,
        visivel_para_observadores:
          origem.visivel_para_observadores === undefined
            ? true
            : origem.visivel_para_observadores,
      };
      const { data, error } = await supabase
        .from('lead_origens')
        .insert([payload])
        .select()
        .single();

      return {
        data: data
          ? {
              ...data,
              visivel_para_observadores:
                typeof data.visivel_para_observadores === 'boolean'
                  ? data.visivel_para_observadores
                  : true,
            }
          : null,
        error,
      };
    } catch (error) {
      console.error('Error creating origem:', error);
      return { data: null, error };
    }
  },

  async updateLeadOrigem(id: string, updates: Partial<LeadOrigem>): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('lead_origens')
        .update(updates)
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error updating origem:', error);
      return { error };
    }
  },

  async deleteLeadOrigem(id: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('lead_origens')
        .delete()
        .eq('id', id);

      return { error };
    } catch (error) {
      console.error('Error deleting origem:', error);
      return { error };
    }
  },

  async getConfigOptions(category: ConfigCategory): Promise<ConfigOption[]> {
    const table = CONFIG_CATEGORY_TABLE_MAP[category];

    if (table) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .order('ordem', { ascending: true })
          .order('label', { ascending: true });

        if (error) {
          if (isTableMissingError(error, table)) {
            return await fetchLegacyConfigOptions(category);
          }
          throw error;
        }

        return (data || []).map(option => normalizeConfigOption(category, option as RawConfigOption));
      } catch (error) {
        if (isTableMissingError(error, table)) {
          return await fetchLegacyConfigOptions(category);
        }
        console.error('Error loading config options:', error);
        return [];
      }
    }

    return await fetchLegacyConfigOptions(category);
  },

  async createConfigOption(
    category: ConfigCategory,
    option: { label: string; value?: string; description?: string; ordem?: number; ativo?: boolean; metadata?: Record<string, any> },
  ): Promise<{ data: ConfigOption | null; error: any }> {
    const table = CONFIG_CATEGORY_TABLE_MAP[category];

    if (table) {
      try {
        const payload: Record<string, any> = {
          label: option.label,
          value: option.value || option.label,
          description: option.description ?? null,
          ordem: option.ordem ?? 0,
          ativo: option.ativo ?? true,
          metadata: option.metadata ?? null,
        };

        const { data, error } = await supabase.from(table).insert([payload]).select().single();

        if (error) {
          if (isTableMissingError(error, table)) {
            return await createLegacyConfigOption(category, option);
          }
          return { data: null, error: toPostgrestError(error) };
        }

        return { data: data ? normalizeConfigOption(category, data as RawConfigOption) : null, error: null };
      } catch (error) {
        if (isTableMissingError(error, table)) {
          return await createLegacyConfigOption(category, option);
        }
        console.error('Error creating config option:', error);
        return { data: null, error: toPostgrestError(error) };
      }
    }

    return await createLegacyConfigOption(category, option);
  },

  async updateConfigOption(
    category: ConfigCategory,
    id: string,
    updates: Partial<Pick<ConfigOption, 'label' | 'value' | 'description' | 'ordem' | 'ativo' | 'metadata'>>,
  ): Promise<{ error: any }> {
    const table = CONFIG_CATEGORY_TABLE_MAP[category];

    if (table) {
      const payload: Record<string, any> = {};

      if (Object.prototype.hasOwnProperty.call(updates, 'label')) {
        payload.label = updates.label ?? '';
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'value')) {
        payload.value = updates.value ?? '';
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'description')) {
        payload.description = updates.description ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'ordem')) {
        payload.ordem = updates.ordem ?? 0;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'ativo')) {
        payload.ativo = updates.ativo;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'metadata')) {
        payload.metadata = updates.metadata ?? null;
      }

      if (Object.keys(payload).length === 0) {
        return { error: null };
      }

      payload.updated_at = new Date().toISOString();

      try {
        const { error } = await supabase.from(table).update(payload).eq('id', id);

        if (error) {
          if (isTableMissingError(error, table)) {
            return await updateLegacyConfigOption(id, updates);
          }
          return { error: toPostgrestError(error) };
        }

        return { error: null };
      } catch (error) {
        if (isTableMissingError(error, table)) {
          return await updateLegacyConfigOption(id, updates);
        }
        console.error('Error updating config option:', error);
        return { error: toPostgrestError(error) };
      }
    }

    return await updateLegacyConfigOption(id, updates);
  },

  async deleteConfigOption(category: ConfigCategory, id: string): Promise<{ error: any }> {
    const table = CONFIG_CATEGORY_TABLE_MAP[category];

    if (table) {
      try {
        const { error } = await supabase.from(table).delete().eq('id', id);

        if (error) {
          if (isTableMissingError(error, table)) {
            return await deleteLegacyConfigOption(id);
          }
          return { error: toPostgrestError(error) };
        }

        return { error: null };
      } catch (error) {
        if (isTableMissingError(error, table)) {
          return await deleteLegacyConfigOption(id);
        }
        console.error('Error deleting config option:', error);
        return { error: toPostgrestError(error) };
      }
    }

    return await deleteLegacyConfigOption(id);
  },

  async getProfilePermissions(): Promise<ProfilePermission[]> {
    try {
      const { data, error, status } = await supabase
        .from(PROFILE_PERMISSIONS_TABLE)
        .select('*')
        .order('role', { ascending: true })
        .order('module', { ascending: true });

      if (error) {
        if (status === 404 || isTableMissingError(error, PROFILE_PERMISSIONS_TABLE)) {
          return [];
        }
        throw error;
      }

      return (data as ProfilePermission[] | null) ?? [];
    } catch (error) {
      if (isTableMissingError(error, PROFILE_PERMISSIONS_TABLE)) {
        return [];
      }

      console.error('Error loading profile permissions:', error);
      return [];
    }
  },

  async upsertProfilePermission(
    role: string,
    module: string,
    updates: Partial<Pick<ProfilePermission, 'can_view' | 'can_edit'>>,
  ): Promise<{ data: ProfilePermission | null; error: PostgrestError | null }> {
    try {
      const { data, error, status } = await supabase
        .from(PROFILE_PERMISSIONS_TABLE)
        .upsert(
          {
            role,
            module,
            ...updates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'role,module', ignoreDuplicates: false },
        )
        .select()
        .single();

      if (error) {
        if (status === 404 || isTableMissingError(error, PROFILE_PERMISSIONS_TABLE)) {
          return {
            data: null,
            error: {
              message: 'Tabela de permissões não encontrada.',
              details: 'A tabela profile_permissions não está disponível no banco de dados.',
              hint: '',
              code: 'PGRST404',
              name: 'PostgrestError',
            },
          };
        }
        return { data: null, error };
      }

      return { data: (data as ProfilePermission) ?? null, error: null };
    } catch (error) {
      if (isTableMissingError(error, PROFILE_PERMISSIONS_TABLE)) {
        return {
          data: null,
          error: {
            message: 'Tabela de permissões não encontrada.',
            details: 'A tabela profile_permissions não está disponível no banco de dados.',
            hint: '',
            code: 'PGRST404',
            name: 'PostgrestError',
          },
        };
      }

      console.error('Error upserting profile permission:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async deleteProfilePermission(id: string): Promise<{ error: PostgrestError | null }> {
    try {
      const { error, status } = await supabase
        .from(PROFILE_PERMISSIONS_TABLE)
        .delete()
        .eq('id', id);

      if (error) {
        if (status === 404 || isTableMissingError(error, PROFILE_PERMISSIONS_TABLE)) {
          return {
            error: {
              message: 'Tabela de permissões não encontrada.',
              details: 'A tabela profile_permissions não está disponível no banco de dados.',
              hint: '',
              code: 'PGRST404',
              name: 'PostgrestError',
            },
          };
        }
        return { error };
      }

      return { error: null };
    } catch (error) {
      if (isTableMissingError(error, PROFILE_PERMISSIONS_TABLE)) {
        return {
          error: {
            message: 'Tabela de permissões não encontrada.',
            details: 'A tabela profile_permissions não está disponível no banco de dados.',
            hint: '',
            code: 'PGRST404',
            name: 'PostgrestError',
          },
        };
      }

      console.error('Error deleting profile permission:', error);
      return { error: toPostgrestError(error) };
    }
  },

  async getIntegrationSetting(slug: string): Promise<IntegrationSetting | null> {
    const localIntegration = getLocalIntegrationSetting(slug);

    try {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .eq('slug', slug)
        .limit(1)
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error, 'integration_settings')) {
          console.warn('integration_settings table not found. Using local fallback.');
          return localIntegration;
        }

        throw error;
      }

      const normalized = data ? normalizeIntegrationSetting(data as IntegrationSetting) : null;
      if (normalized) {
        storeLocalIntegrationSetting(normalized);
      }

      return normalized ?? localIntegration;
    } catch (error) {
      if (isTableMissingError(error, 'integration_settings')) {
        console.warn('integration_settings table not found. Using local fallback.');
        return localIntegration;
      }

      console.error('Error loading integration setting:', error);
      return localIntegration;
    }
  },

  async createIntegrationSetting(
    payload: Pick<IntegrationSetting, 'slug' | 'name'> & Partial<Pick<IntegrationSetting, 'description' | 'settings'>>,
  ): Promise<{ data: IntegrationSetting | null; error: any }> {
    try {
      const insertPayload = {
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Record<string, any>;

      const { data, error } = await supabase
        .from('integration_settings')
        .insert([insertPayload])
        .select()
        .single();

      if (error) {
        return { data: null, error: toPostgrestError(error) };
      }

      const normalized = data ? normalizeIntegrationSetting(data as IntegrationSetting) : null;
      if (normalized) {
        storeLocalIntegrationSetting(normalized);
      }

      return { data: normalized, error: null };
    } catch (error) {
      if (isTableMissingError(error, 'integration_settings')) {
        const localIntegration = createLocalIntegrationSetting(payload);
        return { data: localIntegration, error: null };
      }

      console.error('Error creating integration setting:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },

  async updateIntegrationSetting(
    id: string,
    updates: Partial<Pick<IntegrationSetting, 'name' | 'description' | 'settings'>>,
  ): Promise<{ data: IntegrationSetting | null; error: any }> {
    try {
      const payload: Record<string, any> = { ...updates, updated_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from('integration_settings')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { data: null, error: toPostgrestError(error) };
      }

      const normalized = data ? normalizeIntegrationSetting(data as IntegrationSetting) : null;
      if (normalized) {
        storeLocalIntegrationSetting(normalized);
      }

      return { data: normalized, error: null };
    } catch (error) {
      if (isTableMissingError(error, 'integration_settings')) {
        const localIntegration = updateLocalIntegrationSetting(id, updates);
        if (!localIntegration) {
          return {
            data: null,
            error: {
              message: 'Configuração local não encontrada.',
              details: 'Nenhuma configuração local foi criada para esta integração.',
              hint: '',
              code: 'PGRST404',
              name: 'PostgrestError',
            },
          };
        }

        return { data: localIntegration, error: null };
      }

      console.error('Error updating integration setting:', error);
      return { data: null, error: toPostgrestError(error) };
    }
  },
};
