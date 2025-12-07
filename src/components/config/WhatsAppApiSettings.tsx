import { useCallback, useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Info,
  Key,
  Link,
  Loader2,
  Save,
  Settings,
  ShieldCheck,
} from 'lucide-react';

import { configService } from '../../lib/configService';
import {
  AUTO_CONTACT_INTEGRATION_SLUG,
  normalizeAutoContactSettings,
  type AutoContactSettings,
} from '../../lib/autoContactService';
import type { IntegrationSetting } from '../../lib/supabase';
import { useConfig } from '../../contexts/ConfigContext';

type MessageState = { type: 'success' | 'error'; text: string } | null;

export default function WhatsAppApiSettings() {
  const { leadStatuses } = useConfig();
  const [autoContactIntegration, setAutoContactIntegration] = useState<IntegrationSetting | null>(null);
  const [autoContactSettings, setAutoContactSettings] = useState<AutoContactSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<MessageState>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [statusOnSend, setStatusOnSend] = useState('');

  const loadSettings = useCallback(async () => {
    if (leadStatuses.length === 0) {
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const integration = await configService.getIntegrationSetting(AUTO_CONTACT_INTEGRATION_SLUG);

      console.log('[WhatsAppApiSettings] Loaded from DB:', {
        integration,
        settings: integration?.settings,
        id: integration?.id
      });

      const normalized = normalizeAutoContactSettings(integration?.settings);

      console.log('[WhatsAppApiSettings] After normalization:', normalized);

      setAutoContactIntegration(integration);
      setAutoContactSettings(normalized);

      setEnabled(normalized.enabled);
      setBaseUrl(normalized.baseUrl);
      setSessionId(normalized.sessionId);
      setApiKey(normalized.apiKey);

      const validStatusIds = leadStatuses.map(s => s.id);
      const isValidStatus = normalized.statusOnSend && validStatusIds.includes(normalized.statusOnSend);
      const finalStatus = isValidStatus ? normalized.statusOnSend : leadStatuses[0]?.id || '';

      console.log('[WhatsAppApiSettings] Status check:', {
        fromDB: normalized.statusOnSend,
        isValid: isValidStatus,
        finalStatus,
        validStatusIds
      });

      setStatusOnSend(finalStatus);
    } catch (error) {
      console.error('[WhatsAppApiSettings] Error loading settings:', error);
      setStatusMessage({ type: 'error', text: 'Erro ao carregar configurações.' });
    } finally {
      setLoading(false);
    }
  }, [leadStatuses]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!autoContactIntegration) {
      setStatusMessage({ type: 'error', text: 'Integração de automação não configurada.' });
      return;
    }

    if (!statusOnSend) {
      setStatusMessage({ type: 'error', text: 'Selecione um status válido.' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    const currentMessageFlow = autoContactSettings?.messageFlow || [];

    const newSettings = {
      enabled,
      baseUrl: baseUrl.trim(),
      sessionId: sessionId.trim(),
      apiKey: apiKey.trim(),
      statusOnSend: statusOnSend,
      messageFlow: currentMessageFlow,
    };

    console.log('[WhatsAppApiSettings] Saving settings:', {
      currentState: { enabled, baseUrl, sessionId, apiKey, statusOnSend },
      newSettings
    });

    const { data, error } = await configService.updateIntegrationSetting(autoContactIntegration.id, {
      settings: newSettings,
    });

    console.log('[WhatsAppApiSettings] Save result:', { data: data?.settings, error });

    if (error) {
      setStatusMessage({ type: 'error', text: 'Erro ao salvar a configuração. Tente novamente.' });
    } else {
      const updatedIntegration = data ?? autoContactIntegration;
      const normalized = normalizeAutoContactSettings(updatedIntegration.settings);

      setAutoContactIntegration(updatedIntegration);
      setAutoContactSettings(normalized);
      setEnabled(normalized.enabled);
      setBaseUrl(normalized.baseUrl);
      setSessionId(normalized.sessionId);
      setApiKey(normalized.apiKey);

      const validStatusIds = leadStatuses.map(s => s.id);
      const isValidStatus = normalized.statusOnSend && validStatusIds.includes(normalized.statusOnSend);
      setStatusOnSend(isValidStatus ? normalized.statusOnSend : leadStatuses[0]?.id || '');

      setStatusMessage({ type: 'success', text: 'Configuração salva com sucesso.' });
    }

    setSaving(false);
  };

  if (loading || leadStatuses.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-center gap-3 text-slate-600">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Carregando configurações da API...</span>
      </div>
    );
  }

  if (!autoContactIntegration) {
    return (
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-orange-600 mt-1" />
        <div className="space-y-1 text-sm text-orange-800">
          <p className="font-semibold">Integração de automação não encontrada.</p>
          <p>Execute as migrações mais recentes para habilitar a integração.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      {statusMessage && (
        <div
          className={`p-4 rounded-lg border flex items-center space-x-3 mb-4 ${
            statusMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <ShieldCheck className="w-5 h-5" />
          ) : (
            <Info className="w-5 h-5" />
          )}
          <p>{statusMessage.text}</p>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center gap-2 text-slate-900 font-medium">
          <Settings className="w-5 h-5" />
          Configurações da API do WhatsApp
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Link className="w-4 h-4 text-slate-400" />
              URL da API
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              placeholder="https://api.exemplo.com"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Key className="w-4 h-4 text-slate-400" />
              Session ID
            </label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
              placeholder="seu-session-id"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Key className="w-4 h-4 text-slate-400" />
              API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                placeholder="sua-api-key"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Status ao enviar primeira mensagem
            </label>
            <select
              value={statusOnSend}
              onChange={(e) => setStatusOnSend(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm bg-white"
            >
              {leadStatuses.length === 0 && (
                <option value="">Carregando status...</option>
              )}
              {leadStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.nome}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              O lead será movido para este status ao receber a primeira mensagem automática
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="whatsapp-enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          <label htmlFor="whatsapp-enabled" className="text-sm text-slate-700">
            Ativar automação de contato
          </label>
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-slate-200">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center space-x-2 px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Salvando...' : 'Salvar configuração'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
