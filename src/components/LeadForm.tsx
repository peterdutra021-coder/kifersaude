import { useEffect, useMemo, useState } from 'react';
import { supabase, Lead } from '../lib/supabase';
import { X, Search } from 'lucide-react';
import {
  formatDateForInput,
  formatDateTimeForInput,
  convertLocalToUTC,
} from '../lib/dateUtils';
import { consultarCep, formatCep } from '../lib/cepService';
import { useConfig } from '../contexts/ConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { normalizeSentenceCase, normalizeTitleCase } from '../lib/textNormalization';

type LeadFormProps = {
  lead: Lead | null;
  onClose: () => void;
  onSave: (lead: Lead) => void;
};

type LeadFormState = {
  nome_completo: string;
  telefone: string;
  email: string;
  data_criacao: string;
  cep: string;
  endereco: string;
  cidade: string;
  estado: string;
  regiao: string;
  origem: string;
  tipo_contratacao: string;
  operadora_atual: string;
  status: string;
  responsavel: string;
  proximo_retorno: string;
  observacoes: string;
};

type LeadPayload = LeadFormState;

const normalizePhoneNumber = (value: string) => value.replace(/\D/g, '');

const normalizeEmail = (value: string | null | undefined) =>
  (value || '').trim().toLowerCase();

export default function LeadForm({ lead, onClose, onSave }: LeadFormProps) {
  const { loading: configLoading, leadStatuses, leadOrigins, options } = useConfig();
  const { isObserver } = useAuth();

  const [formData, setFormData] = useState<LeadFormState>({
    nome_completo: lead?.nome_completo || '',
    telefone: lead?.telefone || '',
    email: lead?.email || '',
    data_criacao: formatDateForInput(lead?.data_criacao || new Date().toISOString()),
    cep: lead?.cep || '',
    endereco: lead?.endereco || '',
    cidade: lead?.cidade || '',
    estado: lead?.estado || '',
    regiao: lead?.regiao || '',
    origem: lead?.origem || '',
    tipo_contratacao: lead?.tipo_contratacao || '',
    operadora_atual: lead?.operadora_atual || '',
    status: lead?.status || '',
    responsavel: lead?.responsavel || '',
    proximo_retorno: formatDateTimeForInput(lead?.proximo_retorno),
    observacoes: lead?.observacoes || '',
  });

  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  const activeLeadStatuses = leadStatuses.filter((status) => status.ativo);
  const defaultStatus = activeLeadStatuses.find((status) => status.padrao) || activeLeadStatuses[0];

  const restrictedOriginNames = useMemo(
    () =>
      leadOrigins
        .filter((origin) => origin.visivel_para_observadores === false)
        .map((origin) => origin.nome),
    [leadOrigins],
  );

  const activeOrigins = useMemo(
    () =>
      leadOrigins.filter(
        (origin) =>
          origin.ativo && (!isObserver || !restrictedOriginNames.includes(origin.nome)),
      ),
    [leadOrigins, isObserver, restrictedOriginNames],
  );

  const tipoContratacaoOptions = (options.lead_tipo_contratacao || []).filter(
    (option) => option.ativo,
  );
  const responsavelOptions = (options.lead_responsavel || []).filter(
    (option) => option.ativo,
  );

  useEffect(() => {
    if (!lead && !formData.status && defaultStatus) {
      setFormData((prev) => ({ ...prev, status: defaultStatus.nome }));
    }
  }, [lead, defaultStatus, formData.status]);

  useEffect(() => {
    if (!lead && !formData.origem && activeOrigins.length > 0) {
      setFormData((prev) => ({ ...prev, origem: activeOrigins[0].nome }));
    }
  }, [lead, activeOrigins, formData.origem]);

  useEffect(() => {
    if (!lead && !formData.tipo_contratacao && tipoContratacaoOptions.length > 0) {
      setFormData((prev) => ({ ...prev, tipo_contratacao: tipoContratacaoOptions[0].label }));
    }
  }, [lead, tipoContratacaoOptions, formData.tipo_contratacao]);

  useEffect(() => {
    if (!lead && !formData.responsavel && responsavelOptions.length > 0) {
      setFormData((prev) => ({ ...prev, responsavel: responsavelOptions[0].label }));
    }
  }, [lead, responsavelOptions, formData.responsavel]);

  if (configLoading && !lead) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-slate-600 text-sm">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  const handleCepSearch = async () => {
    if (!formData.cep || formData.cep.replace(/\D/g, '').length !== 8) {
      alert('Por favor, informe um CEP válido');
      return;
    }

    setLoadingCep(true);
    try {
      const data = await consultarCep(formData.cep);
      if (data) {
        setFormData((prev) => ({
          ...prev,
          endereco: data.logradouro,
          cidade: data.localidade,
          estado: data.uf,
          regiao: data.uf,
        }));
      }
    } catch (error) {
      alert('Erro ao consultar CEP. Verifique o CEP informado.');
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCepChange = (value: string) => {
    const formatted = formatCep(value);
    setFormData((prev) => ({ ...prev, cep: formatted }));

    if (formatted.replace(/\D/g, '').length === 8) {
      handleCepSearch();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const creationDateIso = formData.data_criacao
        ? convertLocalToUTC(`${formData.data_criacao}T00:00`)
        : '';
      const nowIso = new Date().toISOString();
      const effectiveCreationDateIso =
        creationDateIso ||
        (formData.data_criacao
          ? new Date(`${formData.data_criacao}T00:00:00-03:00`).toISOString()
          : nowIso);

      const dataToSave: LeadPayload = {
        ...formData,
        data_criacao: effectiveCreationDateIso,
        proximo_retorno: formData.proximo_retorno
          ? convertLocalToUTC(formData.proximo_retorno)
          : null,
        ultimo_contato: formData.data_criacao ? effectiveCreationDateIso : nowIso,
      };

      const normalizedLeadData: LeadPayload = {
        ...dataToSave,
        telefone: normalizePhoneNumber(dataToSave.telefone),
        email: normalizeEmail(dataToSave.email) || null,
        nome_completo: normalizeTitleCase(dataToSave.nome_completo) ?? '',
        cidade: normalizeTitleCase(dataToSave.cidade),
        estado: normalizeSentenceCase(dataToSave.estado),
        regiao: normalizeTitleCase(dataToSave.regiao),
        operadora_atual: normalizeSentenceCase(dataToSave.operadora_atual),
        endereco: normalizeTitleCase(dataToSave.endereco),
      };

      let savedLeadId = lead?.id;

      let savedLead: Lead | null = lead;

      if (lead) {
        const { data: updatedLead, error } = await supabase
          .from('leads')
          .update(normalizedLeadData)
          .eq('id', lead.id)
          .select()
          .single<Lead>();

        if (error) throw error;
        savedLead = updatedLead as Lead;
      } else {
        const duplicateFilters = [
          normalizedLeadData.telefone ? `telefone.eq.${normalizedLeadData.telefone}` : null,
          normalizedLeadData.email ? `email.ilike.${normalizedLeadData.email}` : null,
        ].filter(Boolean);

        if (duplicateFilters.length > 0) {
          const { data: duplicateLead, error: duplicateCheckError } = await supabase
            .from('leads')
            .select('id')
            .or(duplicateFilters.join(','))
            .limit(1)
            .maybeSingle();

          if (duplicateCheckError) {
            throw duplicateCheckError;
          }

          if (duplicateLead) {
            const duplicateStatus = leadStatuses.find((s) => s.nome === 'Duplicado');
            if (duplicateStatus) {
              normalizedLeadData.status = duplicateStatus.nome;
            }
          }
        }

        const { data: insertedLead, error } = await supabase
          .from('leads')
          .insert([normalizedLeadData])
          .select()
          .single<Lead>();

        if (error) throw error;
        savedLead = insertedLead as Lead;
        savedLeadId = insertedLead.id;
      }

      if (formData.proximo_retorno && savedLeadId) {
        const localDate = new Date(formData.proximo_retorno);
        localDate.setMinutes(localDate.getMinutes() - 1);
        const reminderDate = localDate.toISOString();

        const existingReminder = await supabase
          .from('reminders')
          .select('id')
          .eq('lead_id', savedLeadId)
          .eq('tipo', 'Retorno')
          .eq('lido', false)
          .maybeSingle();

        if (existingReminder.data) {
          await supabase
            .from('reminders')
            .update({
              titulo: `Retorno agendado: ${normalizedLeadData.nome_completo}`,
              descricao: `Retorno agendado para ${normalizedLeadData.nome_completo}. Telefone: ${formData.telefone}`,
              data_lembrete: reminderDate,
              prioridade: 'alta',
            })
            .eq('id', existingReminder.data.id);
        } else {
          await supabase.from('reminders').insert([
            {
              lead_id: savedLeadId,
              tipo: 'Retorno',
              titulo: `Retorno agendado: ${normalizedLeadData.nome_completo}`,
              descricao: `Retorno agendado para ${normalizedLeadData.nome_completo}. Telefone: ${formData.telefone}`,
              data_lembrete: reminderDate,
              lido: false,
              prioridade: 'alta',
            },
          ]);
        }
      }

      if (savedLead) {
        onSave(savedLead);
      }
    } catch (error) {
      console.error('Erro ao salvar lead:', error);
      alert('Erro ao salvar lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex w-full items-stretch justify-center bg-slate-900/60 px-0 py-0 sm:items-center sm:px-4 sm:py-6">
      <div className="modal-panel relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <h3 className="text-xl font-bold text-slate-900">
            {lead ? 'Editar Lead' : 'Novo Lead'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={formData.nome_completo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, nome_completo: e.target.value }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Telefone *
              </label>
              <input
                type="tel"
                required
                value={formData.telefone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, telefone: e.target.value }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                CEP
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                {loadingCep && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-teal-500 border-t-transparent"></div>
                  </div>
                )}
                {!loadingCep && formData.cep.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCepSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-600 hover:text-teal-700"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Endereço
              </label>
              <input
                type="text"
                value={formData.endereco}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, endereco: e.target.value }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={formData.cidade}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, cidade: e.target.value }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Estado
              </label>
              <input
                type="text"
                value={formData.estado}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, estado: e.target.value }))
                }
                maxLength={2}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent uppercase"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Origem do Lead *
              </label>
              {activeOrigins.length > 0 ? (
                <select
                  required
                  value={formData.origem}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, origem: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {!activeOrigins.some((origin) => origin.nome === formData.origem) &&
                    formData.origem && (
                      <option value={formData.origem} hidden>
                        Origem selecionada
                      </option>
                    )}
                  {activeOrigins.map((origin) => (
                    <option key={origin.id} value={origin.nome}>
                      {origin.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={formData.origem}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, origem: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Informe a origem"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tipo de Contratação *
              </label>
              {tipoContratacaoOptions.length > 0 ? (
                <select
                  required
                  value={formData.tipo_contratacao}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      tipo_contratacao: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {!tipoContratacaoOptions.some(
                    (option) => option.label === formData.tipo_contratacao,
                  ) &&
                    formData.tipo_contratacao && (
                      <option value={formData.tipo_contratacao} hidden>
                        Tipo selecionado
                      </option>
                    )}
                  {tipoContratacaoOptions.map((option) => (
                    <option key={option.id} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={formData.tipo_contratacao}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      tipo_contratacao: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Informe o tipo de contratação"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Operadora Atual
              </label>
              <input
                type="text"
                value={formData.operadora_atual}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    operadora_atual: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Status *
              </label>
              {activeLeadStatuses.length > 0 ? (
                <select
                  required
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {!activeLeadStatuses.some(
                    (status) => status.nome === formData.status,
                  ) &&
                    formData.status && (
                      <option value={formData.status} hidden>
                        Status selecionado
                      </option>
                    )}
                  {activeLeadStatuses.map((status) => (
                    <option key={status.id} value={status.nome}>
                      {status.nome}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={formData.status}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Informe o status"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Responsável *
              </label>
              {responsavelOptions.length > 0 ? (
                <select
                  required
                  value={formData.responsavel}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      responsavel: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  {!responsavelOptions.some(
                    (option) => option.label === formData.responsavel,
                  ) &&
                    formData.responsavel && (
                      <option value={formData.responsavel} hidden>
                        Responsável selecionado
                      </option>
                    )}
                  {responsavelOptions.map((option) => (
                    <option key={option.id} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={formData.responsavel}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      responsavel: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="Informe o responsável"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Data de criação
              </label>
              <input
                type="date"
                value={formData.data_criacao}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, data_criacao: e.target.value }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Próximo Retorno
              </label>
              <input
                type="datetime-local"
                value={formData.proximo_retorno}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    proximo_retorno: e.target.value,
                  }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Observações
              </label>
              <textarea
                value={formData.observacoes}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    observacoes: e.target.value,
                  }))
                }
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-end sm:gap-0 sm:space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg px-4 py-2 text-slate-700 transition-colors hover:bg-slate-100 sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-teal-600 px-6 py-2 text-white transition-colors hover:bg-teal-700 disabled:opacity-50 sm:w-auto"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
