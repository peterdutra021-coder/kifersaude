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
  const [token, setToken] = useState('');
  const [statusOnSend, setStatusOnSend] = useState('');

  const loadSettings = useCallback(async () => {
    if (leadStatuses.length === 0) {
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const integration = await configService.getIntegrationSetting(AUTO_CONTACT_INTEGRATION_SLUG);
      const normalized = normalizeAutoContactSettings(integration?.settings);

      setAutoContactIntegration(integration);
      setAutoContactSettings(normalized);

      setEnabled(normalized.enabled);
      setToken((normalized as any).token || '');

      const validStatusNames = leadStatuses.map(s => s.nome);
      const isValidStatus = normalized.statusOnSend && validStatusNames.includes(normalized.statusOnSend);
      const finalStatus = isValidStatus ? normalized.statusOnSend : leadStatuses[0]?.nome || '';

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
      token: token.trim(),
      statusOnSend: statusOnSend,
      messageFlow: currentMessageFlow,
    };

    const { data, error } = await configService.updateIntegrationSetting(autoContactIntegration.id, {
      settings: newSettings,
    });

    if (error) {
      setStatusMessage({ type: 'error', text: 'Erro ao salvar a configuração. Tente novamente.' });
    } else {
      const updatedIntegration = data ?? autoContactIntegration;
      const normalized = normalizeAutoContactSettings(updatedIntegration.settings);

      setAutoContactIntegration(updatedIntegration);
      setAutoContactSettings(normalized);
      setEnabled(normalized.enabled);
      setToken((normalized as any).token || '');

      const validStatusNames = leadStatuses.map(s => s.nome);
      const isValidStatus = normalized.statusOnSend && validStatusNames.includes(normalized.statusOnSend);
      setStatusOnSend(isValidStatus ? normalized.statusOnSend : leadStatuses[0]?.nome || '');

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
          Configurações da API Whapi Cloud
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2 text-sm text-blue-900">
              <p className="font-semibold">Como obter seu token da Whapi Cloud:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Acesse <a href="https://whapi.cloud" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-700">whapi.cloud</a> e crie uma conta</li>
                <li>Após o login, vá para o painel de controle</li>
                <li>Configure um canal conectando seu WhatsApp</li>
                <li>Copie o token de autenticação do seu canal</li>
                <li>Cole o token no campo abaixo</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Key className="w-4 h-4 text-slate-400" />
              Token da Whapi Cloud
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm font-mono"
                placeholder="Bearer token da Whapi Cloud"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Este token será usado para autenticação com a API da Whapi Cloud
            </p>
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
                <option key={status.id} value={status.nome}>
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
