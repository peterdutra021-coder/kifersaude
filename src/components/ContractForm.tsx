import { useState, useEffect, useMemo } from 'react';
import { supabase, Contract, Lead, ContractValueAdjustment, Operadora } from '../lib/supabase';
import { X, User, Plus, Trash2, TrendingUp, TrendingDown, AlertCircle, Search } from 'lucide-react';
import HolderForm from './HolderForm';
import ValueAdjustmentForm from './ValueAdjustmentForm';
import { configService } from '../lib/configService';
import { useConfig } from '../contexts/ConfigContext';
import { useConfirmationModal } from '../hooks/useConfirmationModal';
import { consultarEmpresaPorCNPJ } from '../lib/receitaService';

type CommissionInstallment = {
  percentual: string;
  data_pagamento: string;
};

type ContractFormProps = {
  contract: Contract | null;
  leadToConvert?: Lead | null;
  onClose: () => void;
  onSave: () => void;
};

export default function ContractForm({ contract, leadToConvert, onClose, onSave }: ContractFormProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [operadoras, setOperadoras] = useState<Operadora[]>([]);
  const { options, leadStatuses } = useConfig();
  const [formData, setFormData] = useState({
    codigo_contrato: contract?.codigo_contrato || '',
    lead_id: contract?.lead_id || leadToConvert?.id || '',
    status: contract?.status || '',
    modalidade: contract?.modalidade || leadToConvert?.tipo_contratacao || '',
    operadora: contract?.operadora || leadToConvert?.operadora_atual || '',
    produto_plano: contract?.produto_plano || '',
    abrangencia: contract?.abrangencia || '',
    acomodacao: contract?.acomodacao || '',
    data_inicio: contract?.data_inicio || '',
    data_renovacao: contract?.data_renovacao ? contract.data_renovacao.substring(0, 7) : '',
    mes_reajuste: contract?.mes_reajuste ? contract.mes_reajuste.toString().padStart(2, '0') : '',
    carencia: contract?.carencia || '',
    mensalidade_total: contract?.mensalidade_total?.toString() || '',
    comissao_prevista: contract?.comissao_prevista?.toString() || '',
    comissao_multiplicador: contract?.comissao_multiplicador?.toString() || '2.8',
    comissao_recebimento_adiantado:
      contract?.comissao_recebimento_adiantado ?? true,
    previsao_recebimento_comissao: contract?.previsao_recebimento_comissao || '',
    previsao_pagamento_bonificacao: contract?.previsao_pagamento_bonificacao || '',
    vidas: contract?.vidas?.toString() || '1',
    bonus_por_vida_valor: contract?.bonus_por_vida_valor?.toString() || '',
    bonus_por_vida_aplicado: contract?.bonus_por_vida_aplicado || false,
    bonus_limite_mensal: contract?.bonus_limite_mensal?.toString() || '',
    responsavel: contract?.responsavel || leadToConvert?.responsavel || '',
    observacoes_internas: contract?.observacoes_internas || '',
    cnpj: contract?.cnpj || '',
    razao_social: contract?.razao_social || '',
    nome_fantasia: contract?.nome_fantasia || '',
    endereco_empresa: contract?.endereco_empresa || '',
  });
  const [commissionInstallments, setCommissionInstallments] = useState<CommissionInstallment[]>(() =>
    Array.isArray(contract?.comissao_parcelas)
      ? (contract?.comissao_parcelas || []).map(parcel => ({
          percentual: parcel.percentual?.toString() ?? '',
          data_pagamento: parcel.data_pagamento ?? '',
        }))
      : []
  );
  const [saving, setSaving] = useState(false);
  const [showHolderForm, setShowHolderForm] = useState(false);
  const [contractId, setContractId] = useState<string | null>(contract?.id || null);
  const [adjustments, setAdjustments] = useState<ContractValueAdjustment[]>([]);
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<ContractValueAdjustment | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const [cnpjLookupError, setCnpjLookupError] = useState<string | null>(null);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const contractStatusOptions = useMemo(
    () => (options.contract_status || []).filter(option => option.ativo),
    [options.contract_status]
  );
  const modalidadeOptions = useMemo(() => (options.contract_modalidade || []).filter(option => option.ativo), [options.contract_modalidade]);
  const abrangenciaOptions = useMemo(() => (options.contract_abrangencia || []).filter(option => option.ativo), [options.contract_abrangencia]);
  const acomodacaoOptions = useMemo(() => (options.contract_acomodacao || []).filter(option => option.ativo), [options.contract_acomodacao]);
  const carenciaOptions = useMemo(() => (options.contract_carencia || []).filter(option => option.ativo), [options.contract_carencia]);
  const responsavelOptions = useMemo(
    () => (options.lead_responsavel || []).filter(option => option.ativo),
    [options.lead_responsavel]
  );
  const modalidadeRequerCNPJ = useMemo(() => {
    const normalized = (formData.modalidade || '').toLowerCase();
    return ['pme', 'empresarial', 'cnpj'].some(keyword => normalized.includes(keyword));
  }, [formData.modalidade]);
  const convertibleLeadStatuses = useMemo(
    () => leadStatuses.filter(status => status.ativo).map(status => status.nome),
    [leadStatuses]
  );

  const totalInstallmentPercent = useMemo(
    () =>
      commissionInstallments.reduce((sum, parcel) => {
        const percentual = parseFloat(parcel.percentual || '0');
        return sum + (isNaN(percentual) ? 0 : percentual);
      }, 0),
    [commissionInstallments]
  );

  const MAX_COMMISSION_PERCENT = 280;

  useEffect(() => {
    if (!contract && !formData.status && contractStatusOptions.length > 0) {
      setFormData(prev => ({ ...prev, status: contractStatusOptions[0].value }));
    }
  }, [contract, contractStatusOptions, formData.status]);

  useEffect(() => {
    if (!contract && !formData.modalidade && modalidadeOptions.length > 0) {
      const defaultValue = leadToConvert?.tipo_contratacao && modalidadeOptions.some(option => option.value === leadToConvert.tipo_contratacao)
        ? leadToConvert.tipo_contratacao
        : modalidadeOptions[0].value;
      setFormData(prev => ({ ...prev, modalidade: defaultValue }));
    }
  }, [contract, modalidadeOptions, formData.modalidade, leadToConvert?.tipo_contratacao]);

  useEffect(() => {
    if (!contract && !formData.abrangencia && abrangenciaOptions.length > 0) {
      setFormData(prev => ({ ...prev, abrangencia: abrangenciaOptions[0].value }));
    }
  }, [contract, abrangenciaOptions, formData.abrangencia]);

  useEffect(() => {
    if (!contract && !formData.acomodacao && acomodacaoOptions.length > 0) {
      setFormData(prev => ({ ...prev, acomodacao: acomodacaoOptions[0].value }));
    }
  }, [contract, acomodacaoOptions, formData.acomodacao]);

  useEffect(() => {
    if (!contract && !formData.carencia && carenciaOptions.length > 0) {
      setFormData(prev => ({ ...prev, carencia: carenciaOptions[0].value }));
    }
  }, [contract, carenciaOptions, formData.carencia]);

  useEffect(() => {
    if (!contract && !formData.responsavel && responsavelOptions.length > 0) {
      const defaultResponsavel = leadToConvert?.responsavel && responsavelOptions.some(option => option.value === leadToConvert.responsavel)
        ? leadToConvert.responsavel
        : responsavelOptions[0].value;
      setFormData(prev => ({ ...prev, responsavel: defaultResponsavel }));
    }
  }, [contract, responsavelOptions, formData.responsavel, leadToConvert?.responsavel]);

  useEffect(() => {
    loadLeads();
    loadOperadoras();
    if (contract?.id) {
      loadAdjustments(contract.id);
    }
  }, [contract?.id, convertibleLeadStatuses]);

  const calculateAdjustedValue = (baseValue: number): number => {
    let total = baseValue;
    adjustments.forEach(adj => {
      if (adj.tipo === 'acrescimo') {
        total += adj.valor;
      } else {
        total -= adj.valor;
      }
    });
    return total;
  };

  const baseMensalidade = parseFloat(formData.mensalidade_total || '0') || 0;

  const adjustedMensalidade = useMemo(
    () => calculateAdjustedValue(baseMensalidade),
    [baseMensalidade, adjustments]
  );

  useEffect(() => {
    if (adjustedMensalidade > 0) {
      const multiplicador = parseFloat(formData.comissao_multiplicador || '0');
      const effectivePercentual =
        !formData.comissao_recebimento_adiantado && totalInstallmentPercent > 0
          ? Math.min(totalInstallmentPercent, MAX_COMMISSION_PERCENT) / 100
          : multiplicador;

      if (!isNaN(effectivePercentual)) {
        const comissao = adjustedMensalidade * effectivePercentual;
        setFormData(prev => ({ ...prev, comissao_prevista: comissao.toFixed(2) }));
      }
    }
  }, [
    adjustedMensalidade,
    formData.comissao_multiplicador,
    formData.comissao_recebimento_adiantado,
    totalInstallmentPercent,
    adjustments,
  ]);

  const loadLeads = async () => {
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .eq('arquivado', false);

      if (convertibleLeadStatuses.length > 0) {
        query = query.in('status', convertibleLeadStatuses);
      }

      const { data, error } = await query.order('nome_completo');

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
    }
  };

  const loadOperadoras = async () => {
    const data = await configService.getOperadoras();
    setOperadoras(data.filter(op => op.ativo));
  };

  const handleOperadoraChange = (operadoraNome: string) => {
    const operadora = operadoras.find(op => op.nome === operadoraNome);
    if (operadora) {
      setFormData(prev => ({
        ...prev,
        operadora: operadoraNome,
        bonus_por_vida_aplicado: operadora.bonus_por_vida,
        bonus_por_vida_valor: operadora.bonus_padrao > 0 ? operadora.bonus_padrao.toString() : prev.bonus_por_vida_valor,
      }));
    } else {
      setFormData(prev => ({ ...prev, operadora: operadoraNome }));
    }
  };

  const handleConsultarCNPJ = async () => {
    setCnpjLookupError(null);
    setCnpjLoading(true);

    try {
      const empresa = await consultarEmpresaPorCNPJ(formData.cnpj);
      const enderecoCompleto = [
        empresa.endereco,
        empresa.numero,
        empresa.bairro,
        empresa.cidade && empresa.estado ? `${empresa.cidade} - ${empresa.estado}` : empresa.cidade,
        empresa.cep ? `CEP: ${empresa.cep}` : '',
      ]
        .filter(Boolean)
        .join(', ');

      setFormData(prev => ({
        ...prev,
        razao_social: empresa.razao_social || prev.razao_social,
        nome_fantasia: empresa.nome_fantasia || prev.nome_fantasia,
        endereco_empresa: enderecoCompleto || prev.endereco_empresa,
      }));
    } catch (error) {
      console.error('Erro ao consultar CNPJ do contrato:', error);
      setCnpjLookupError(error instanceof Error ? error.message : 'Não foi possível consultar CNPJ');
    } finally {
      setCnpjLoading(false);
    }
  };

  const loadAdjustments = async (contractId: string) => {
    try {
      const { data, error } = await supabase
        .from('contract_value_adjustments')
        .select('*')
        .eq('contract_id', contractId)
        .order('created_at');

      if (error) throw error;
      setAdjustments(data || []);
    } catch (error) {
      console.error('Erro ao carregar ajustes:', error);
    }
  };

  const vidasNumber = parseFloat(formData.vidas || '1') || 1;
  const bonusPorVidaValor = parseFloat(formData.bonus_por_vida_valor || '0') || 0;
  const bonusLimiteMensalValor = parseFloat(formData.bonus_limite_mensal || '0') || 0;
  const bonusTotal = bonusPorVidaValor * vidasNumber;
  const bonusLimiteTotal = bonusLimiteMensalValor > 0 ? bonusLimiteMensalValor * vidasNumber : 0;
  const bonusParcelasEstimadas = bonusLimiteTotal > 0 ? Math.ceil(bonusTotal / bonusLimiteTotal) : 1;

  const handleDeleteAdjustment = async (id: string) => {
    const confirmed = await requestConfirmation({
      title: 'Remover ajuste',
      description: 'Deseja remover este ajuste? Esta ação não pode ser desfeita.',
      confirmLabel: 'Remover',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('contract_value_adjustments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      if (contract?.id) {
        await loadAdjustments(contract.id);
      }
    } catch (error) {
      console.error('Erro ao remover ajuste:', error);
      alert('Erro ao remover ajuste');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const codigo = formData.codigo_contrato.trim();

      if (!codigo) {
        alert('Informe o código do contrato.');
        return;
      }

      const installmentsPayload = commissionInstallments
        .map(parcel => ({
          percentual: parseFloat(parcel.percentual || '0'),
          data_pagamento: parcel.data_pagamento || null,
        }))
        .filter(parcel => !isNaN(parcel.percentual) && parcel.percentual > 0);

      if (!formData.comissao_recebimento_adiantado) {
        if (installmentsPayload.length === 0) {
          alert('Adicione ao menos uma parcela de comissão ou marque como adiantamento.');
          setSaving(false);
          return;
        }

        const hasMissingDates = installmentsPayload.some(parcel => !parcel.data_pagamento);
        if (hasMissingDates) {
          alert('Informe a data prevista de pagamento para cada parcela.');
          setSaving(false);
          return;
        }

        if (totalInstallmentPercent > MAX_COMMISSION_PERCENT) {
          alert(`O total das parcelas não pode ultrapassar ${MAX_COMMISSION_PERCENT}% da mensalidade.`);
          setSaving(false);
          return;
        }
      }

      const dataToSave = {
        codigo_contrato: codigo,
        lead_id: formData.lead_id || null,
        status: formData.status,
        modalidade: formData.modalidade,
        operadora: formData.operadora,
        produto_plano: formData.produto_plano,
        abrangencia: formData.abrangencia || null,
        acomodacao: formData.acomodacao || null,
        data_inicio: formData.data_inicio || null,
        data_renovacao: formData.data_renovacao ? `${formData.data_renovacao}-01` : null,
        mes_reajuste: formData.mes_reajuste ? parseInt(formData.mes_reajuste, 10) : null,
        carencia: formData.carencia || null,
        mensalidade_total: formData.mensalidade_total ? parseFloat(formData.mensalidade_total) : null,
        comissao_prevista: formData.comissao_prevista ? parseFloat(formData.comissao_prevista) : null,
        comissao_multiplicador: formData.comissao_multiplicador ? parseFloat(formData.comissao_multiplicador) : 2.8,
        comissao_recebimento_adiantado: formData.comissao_recebimento_adiantado,
        comissao_parcelas: formData.comissao_recebimento_adiantado ? [] : installmentsPayload,
        previsao_recebimento_comissao: formData.previsao_recebimento_comissao || null,
        previsao_pagamento_bonificacao: formData.previsao_pagamento_bonificacao || null,
        vidas: formData.vidas ? parseInt(formData.vidas) : 1,
        bonus_por_vida_valor: formData.bonus_por_vida_valor ? parseFloat(formData.bonus_por_vida_valor) : null,
        bonus_por_vida_aplicado: formData.bonus_por_vida_aplicado,
        bonus_limite_mensal: formData.bonus_limite_mensal ? parseFloat(formData.bonus_limite_mensal) : null,
        responsavel: formData.responsavel,
        observacoes_internas: formData.observacoes_internas || null,
        cnpj: formData.cnpj || null,
        razao_social: formData.razao_social || null,
        nome_fantasia: formData.nome_fantasia || null,
        endereco_empresa: formData.endereco_empresa || null,
      };

      const normalizedContractData = {
        ...dataToSave,
        status: normalizeSentenceCase(dataToSave.status) ?? dataToSave.status,
        modalidade: normalizeSentenceCase(dataToSave.modalidade) ?? dataToSave.modalidade,
        operadora: normalizeSentenceCase(dataToSave.operadora) ?? dataToSave.operadora,
        produto_plano: normalizeSentenceCase(dataToSave.produto_plano) ?? dataToSave.produto_plano,
        abrangencia: normalizeSentenceCase(dataToSave.abrangencia),
        acomodacao: normalizeSentenceCase(dataToSave.acomodacao),
        carencia: normalizeSentenceCase(dataToSave.carencia),
        responsavel: normalizeTitleCase(dataToSave.responsavel) ?? dataToSave.responsavel,
      };

      if (contract) {
        const { error } = await supabase
          .from('contracts')
          .update(normalizedContractData)
          .eq('id', contract.id);

        if (error) throw error;
        onSave();
      } else {
        const { data, error } = await supabase
          .from('contracts')
          .insert([normalizedContractData])
          .select()
          .single();

        if (error) throw error;

        if (leadToConvert) {
          await supabase
            .from('leads')
            .update({ status: 'Fechado' })
            .eq('id', leadToConvert.id);
        }

        setContractId(data.id);
        setShowHolderForm(true);
      }
    } catch (error) {
      console.error('Erro ao salvar contrato:', error);
      alert('Erro ao salvar contrato');
    } finally {
      setSaving(false);
    }
  };

  if (showHolderForm && contractId) {
    return (
      <HolderForm
        contractId={contractId}
        modalidade={formData.modalidade}
        onClose={onClose}
        onSave={onSave}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-stretch justify-center z-50 p-0 sm:items-center sm:p-4">
      <div className="modal-panel bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {contract ? 'Editar Contrato' : leadToConvert ? 'Converter Lead em Contrato' : 'Novo Contrato'}
            </h3>
            {leadToConvert && (
              <p className="text-sm text-slate-600 mt-1">
                Lead: {leadToConvert.nome_completo} - {leadToConvert.telefone}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6 bg-teal-50 rounded-lg p-4">
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center">
              <User className="w-5 h-5 mr-2" />
              Informações do Contrato
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Código do Contrato
                </label>
                <input
                  type="text"
                  required
                  value={formData.codigo_contrato}
                  onChange={(e) => setFormData({ ...formData, codigo_contrato: e.target.value })}
                  placeholder="Informe o código fornecido pela operadora"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Lead Vinculado
                </label>
                <select
                  value={formData.lead_id}
                  onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Nenhum</option>
                  {leads.map(lead => (
                    <option key={lead.id} value={lead.id}>{lead.nome_completo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status *
                </label>
                {contractStatusOptions.length > 0 ? (
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    {contractStatusOptions.map(option => (
                      <option key={option.id} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Configure os status de contrato"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Modalidade *
                </label>
                {modalidadeOptions.length > 0 ? (
                  <select
                    required
                    value={formData.modalidade}
                    onChange={(e) => setFormData({ ...formData, modalidade: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    {modalidadeOptions.map(option => (
                      <option key={option.id} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={formData.modalidade}
                    onChange={(e) => setFormData({ ...formData, modalidade: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Informe a modalidade"
                  />
                )}
              </div>

              {modalidadeRequerCNPJ && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      CNPJ (Receita)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.cnpj}
                        onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                        className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={handleConsultarCNPJ}
                        disabled={cnpjLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={cnpjLoading ? 'Buscando...' : 'Buscar na Receita'}
                      >
                        <Search className={`w-5 h-5 ${cnpjLoading ? 'animate-pulse' : ''}`} />
                      </button>
                    </div>
                    {cnpjLookupError && <p className="text-xs text-red-600 mt-1">{cnpjLookupError}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Razão Social
                    </label>
                    <input
                      type="text"
                      value={formData.razao_social}
                      onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nome Fantasia
                    </label>
                    <input
                      type="text"
                      value={formData.nome_fantasia}
                      onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Endereço da Empresa (Receita)
                    </label>
                    <textarea
                      value={formData.endereco_empresa}
                      onChange={(e) => setFormData({ ...formData, endereco_empresa: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      rows={2}
                      placeholder="Preenchido automaticamente pela consulta do CNPJ"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Operadora *
                </label>
                <select
                  required
                  value={formData.operadora}
                  onChange={(e) => handleOperadoraChange(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Selecione uma operadora</option>
                  {operadoras.map(op => (
                    <option key={op.id} value={op.nome}>{op.nome}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Comissão e bônus serão preenchidos automaticamente
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Produto/Plano *
                </label>
                <input
                  type="text"
                  required
                  value={formData.produto_plano}
                  onChange={(e) => setFormData({ ...formData, produto_plano: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Abrangência
                </label>
                {abrangenciaOptions.length > 0 ? (
                  <select
                    value={formData.abrangencia}
                    onChange={(e) => setFormData({ ...formData, abrangencia: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    {abrangenciaOptions.map(option => (
                      <option key={option.id} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.abrangencia}
                    onChange={(e) => setFormData({ ...formData, abrangencia: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Informe a abrangência"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Acomodação
                </label>
                {acomodacaoOptions.length > 0 ? (
                  <select
                    value={formData.acomodacao}
                    onChange={(e) => setFormData({ ...formData, acomodacao: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    {acomodacaoOptions.map(option => (
                      <option key={option.id} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.acomodacao}
                    onChange={(e) => setFormData({ ...formData, acomodacao: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Informe a acomodação"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Data de Início
                </label>
                <input
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fim da fidelidade
                </label>
                <input
                  type="month"
                  value={formData.data_renovacao}
                  onChange={(e) => setFormData({ ...formData, data_renovacao: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="MM/AAAA"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mês de reajuste
                </label>
                <select
                  value={formData.mes_reajuste}
                  onChange={(e) =>
                    setFormData({ ...formData, mes_reajuste: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">Selecione</option>
                  <option value="01">Janeiro</option>
                  <option value="02">Fevereiro</option>
                  <option value="03">Março</option>
                  <option value="04">Abril</option>
                  <option value="05">Maio</option>
                  <option value="06">Junho</option>
                  <option value="07">Julho</option>
                  <option value="08">Agosto</option>
                  <option value="09">Setembro</option>
                  <option value="10">Outubro</option>
                  <option value="11">Novembro</option>
                  <option value="12">Dezembro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Carência
                </label>
                {carenciaOptions.length > 0 ? (
                  <select
                    value={formData.carencia}
                    onChange={(e) => setFormData({ ...formData, carencia: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    {carenciaOptions.map(option => (
                      <option key={option.id} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.carencia}
                    onChange={(e) => setFormData({ ...formData, carencia: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Informe a carência"
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Mensalidade Base (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.mensalidade_total}
                  onChange={(e) => setFormData({ ...formData, mensalidade_total: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              {contract?.id && (
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Ajustes de Valor
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAdjustment(null);
                        setShowAdjustmentForm(true);
                      }}
                      className="flex items-center space-x-1 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar Ajuste</span>
                    </button>
                  </div>

                  {adjustments.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {adjustments.map((adj) => (
                        <div
                          key={adj.id}
                          className={`flex items-start justify-between p-3 rounded-lg border ${
                            adj.tipo === 'acrescimo'
                              ? 'bg-green-50 border-green-200'
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-start space-x-2 flex-1">
                            {adj.tipo === 'acrescimo' ? (
                              <TrendingUp className="w-4 h-4 text-green-600 mt-0.5" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-600 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span
                                  className={`font-semibold ${
                                    adj.tipo === 'acrescimo' ? 'text-green-700' : 'text-red-700'
                                  }`}
                                >
                                  {adj.tipo === 'acrescimo' ? '+' : '-'} R${' '}
                                  {adj.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600 mt-1">{adj.motivo}</p>
                              <p className="text-xs text-slate-500 mt-1">
                                {adj.created_by} - {new Date(adj.created_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAdjustment(adj.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic mb-3">Nenhum ajuste aplicado</p>
                  )}

                  {formData.mensalidade_total && (
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">Mensalidade Final:</span>
                        <span className="font-bold text-teal-700 text-lg">
                          R${' '}
                          {calculateAdjustedValue(
                            parseFloat(formData.mensalidade_total)
                          ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Multiplicador de Comissão
                </label>
                <div className="bg-gradient-to-r from-teal-50 to-blue-50 rounded-lg p-4 border border-teal-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-600">Valor do multiplicador:</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl font-bold text-teal-700">
                        {formData.comissao_multiplicador}x
                      </span>
                      {parseFloat(formData.comissao_multiplicador) !== 2.8 && (
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    value={formData.comissao_multiplicador}
                    onChange={(e) =>
                      setFormData({ ...formData, comissao_multiplicador: e.target.value })
                    }
                    className="w-full h-2 bg-teal-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                    <span>0x</span>
                    <span className="text-teal-600 font-medium">2.8x (padrão)</span>
                    <span>10x</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Comissão Prevista (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.comissao_prevista}
                  onChange={(e) => setFormData({ ...formData, comissao_prevista: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-slate-50"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Calculada automaticamente com base no multiplicador
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Previsão Recebimento Comissão
                </label>
                <input
                  type="date"
                  value={formData.previsao_recebimento_comissao}
                  onChange={(e) => setFormData({ ...formData, previsao_recebimento_comissao: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div className="md:col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Forma de recebimento da comissão
                </span>
                <label className="flex items-start space-x-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <input
                    type="checkbox"
                    checked={formData.comissao_recebimento_adiantado}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        comissao_recebimento_adiantado: e.target.checked,
                      })
                    }
                    className="mt-1 w-5 h-5 text-teal-600 border-slate-300 rounded focus:ring-2 focus:ring-teal-500"
                  />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Receber comissão adiantada (pagamento único)
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Quando marcado, todo o valor previsto será considerado no primeiro mês. Desmarque para distribuir a
                        comissão em parcelas com percentuais e datas específicas.
                      </p>
                    </div>
                  </label>

                {!formData.comissao_recebimento_adiantado && (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Parcelas personalizadas</p>
                        <p className="text-xs text-slate-600">
                          Distribua até {MAX_COMMISSION_PERCENT}% da mensalidade em parcelas, definindo o percentual e a data de
                          pagamento de cada mês.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddInstallment}
                        className="inline-flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Adicionar parcela</span>
                      </button>
                    </div>

                    {commissionInstallments.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 bg-slate-50">
                        Nenhuma parcela definida. Adicione ao menos uma para indicar como a comissão será recebida.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {commissionInstallments.map((parcel, index) => {
                          const percentual = parseFloat(parcel.percentual || '0');
                          const value = !isNaN(percentual)
                            ? (adjustedMensalidade * percentual) / 100
                            : 0;

                          return (
                            <div
                              key={`parcel-${index}`}
                              className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-800">Parcela {index + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInstallment(index)}
                                  className="text-slate-400 hover:text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-slate-600 mb-1">Percentual</label>
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="number"
                                      min="0"
                                      max={MAX_COMMISSION_PERCENT}
                                      step="0.01"
                                      value={parcel.percentual}
                                      onChange={(e) => handleInstallmentChange(index, 'percentual', e.target.value)}
                                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                      placeholder="0.00"
                                    />
                                    <span className="text-sm text-slate-500">%</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-1">
                                    Valor estimado: R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-slate-600 mb-1">Data de pagamento</label>
                                  <input
                                    type="date"
                                    value={parcel.data_pagamento}
                                    onChange={(e) => handleInstallmentChange(index, 'data_pagamento', e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                  />
                                  <p className="text-[11px] text-slate-500 mt-1">Defina o dia previsto para esta parcela.</p>
                                </div>
                                <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 flex flex-col justify-center">
                                  <span className="text-[11px] text-teal-700">Total acumulado</span>
                                  <span className="text-lg font-bold text-teal-800">
                                    {totalInstallmentPercent.toFixed(2)}%
                                  </span>
                                  <span className="text-xs text-teal-700">Limite: {MAX_COMMISSION_PERCENT}%</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-700">Total das parcelas</p>
                        <p className="text-xs text-slate-500">
                          {totalInstallmentPercent.toFixed(2)}% ({totalCommissionFromInstallments.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })})
                        </p>
                        <p className="text-xs text-slate-500">
                          Restante disponível: {Math.max(0, MAX_COMMISSION_PERCENT - totalInstallmentPercent).toFixed(2)}%
                        </p>
                      </div>
                      {totalInstallmentPercent > MAX_COMMISSION_PERCENT && (
                        <div className="flex items-center space-x-2 text-amber-600 mt-2 sm:mt-0">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-xs font-medium">
                            O total excede o limite permitido de {MAX_COMMISSION_PERCENT}%.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Quantidade de Vidas *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.vidas}
                  onChange={(e) => setFormData({ ...formData, vidas: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="1"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Titular + Dependentes
                </p>
              </div>

              <div>
                <label className="flex items-center space-x-2 cursor-pointer pt-6">
                  <input
                    type="checkbox"
                    checked={formData.bonus_por_vida_aplicado}
                    onChange={(e) => setFormData({ ...formData, bonus_por_vida_aplicado: e.target.checked })}
                    className="w-5 h-5 text-teal-600 border-slate-300 rounded focus:ring-2 focus:ring-teal-500"
                  />
                  <span className="text-sm font-medium text-slate-700">Aplicar Bônus por Vida</span>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  Pagamento único por vida do contrato
                </p>
              </div>

              {formData.bonus_por_vida_aplicado && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Bônus por Vida (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.bonus_por_vida_valor}
                      onChange={(e) => setFormData({ ...formData, bonus_por_vida_valor: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Total: R$ {bonusTotal.toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Limite mensal do bônus por vida (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.bonus_limite_mensal}
                      onChange={(e) => setFormData({ ...formData, bonus_limite_mensal: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Use 0 para sem limite"
                    />
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Use quando a operadora limitar o pagamento mensal ao valor da vida (ex.: bônus maior que a mensalidade).
                      {bonusLimiteTotal > 0 && (
                        <span className="block text-[11px] text-slate-600 mt-1">
                          Estimativa mensal: R$ {bonusLimiteTotal.toFixed(2)} por {bonusParcelasEstimadas} mês(es) até quitar.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {(formData.bonus_por_vida_aplicado || formData.previsao_pagamento_bonificacao) && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Previsão Pagamento Bonificação
                </label>
                <input
                  type="date"
                  value={formData.previsao_pagamento_bonificacao}
                  onChange={(e) =>
                    setFormData({ ...formData, previsao_pagamento_bonificacao: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Informe quando a bonificação deverá ser recebida.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Responsável *
                </label>
                {responsavelOptions.length > 0 ? (
                  <select
                    required
                    value={formData.responsavel}
                    onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    {responsavelOptions.map(option => (
                      <option key={option.id} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={formData.responsavel}
                    onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    placeholder="Informe o responsável"
                  />
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Observações Internas
                </label>
                <textarea
                  value={formData.observacoes_internas}
                  onChange={(e) => setFormData({ ...formData, observacoes_internas: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : contract ? 'Salvar' : 'Continuar para Titular'}
            </button>
          </div>
        </form>
      </div>

      {showAdjustmentForm && contract?.id && (
        <ValueAdjustmentForm
          contractId={contract.id}
          adjustment={editingAdjustment || undefined}
          responsavel={formData.responsavel}
          onClose={() => {
            setShowAdjustmentForm(false);
            setEditingAdjustment(null);
          }}
        onSave={async () => {
          setShowAdjustmentForm(false);
          setEditingAdjustment(null);
            if (contract?.id) {
              await loadAdjustments(contract.id);
            }
          }}
        />
      )}
      {ConfirmationDialog}
    </div>
  );
}
