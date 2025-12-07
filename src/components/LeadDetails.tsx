import { useState, useEffect } from 'react';
import { supabase, Lead, Interaction } from '../lib/supabase';
import { X, MessageCircle, Plus, Pencil, Trash2 } from 'lucide-react';
import { formatDateTimeFullBR } from '../lib/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import LeadStatusHistoryComponent from './LeadStatusHistory';
import NextStepSuggestion from './NextStepSuggestion';

type LeadWithRelations = Lead & {
  status_nome?: string | null;
  responsavel_label?: string | null;
};

type LeadDetailsProps = {
  lead: LeadWithRelations;
  onClose: () => void;
  onUpdate: () => void;
  onEdit: (lead: LeadWithRelations) => void;
  onDelete?: (lead: LeadWithRelations) => void;
};

export default function LeadDetails({ lead, onClose, onUpdate, onEdit, onDelete }: LeadDetailsProps) {
  const { isObserver } = useAuth();
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    tipo: 'Observação',
    descricao: '',
    responsavel: 'Luiza',
  });

  useEffect(() => {
    loadInteractions();
  }, [lead.id]);

  const loadInteractions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('lead_id', lead.id)
        .order('data_interacao', { ascending: false });

      if (error) throw error;
      setInteractions(data || []);
    } catch (error) {
      console.error('Erro ao carregar interações:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('interactions')
        .insert([
          {
            lead_id: lead.id,
            ...formData,
          },
        ]);

      if (error) throw error;

      await supabase
        .from('leads')
        .update({ ultimo_contato: new Date().toISOString() })
        .eq('id', lead.id);

      setFormData({ tipo: 'Observação', descricao: '', responsavel: 'Luiza' });
      setShowForm(false);
      loadInteractions();
      onUpdate();
    } catch (error) {
      console.error('Erro ao adicionar interação:', error);
      alert('Erro ao adicionar interação');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex w-full items-stretch justify-center bg-slate-900/60 px-0 py-0 sm:items-center sm:px-4 sm:py-6">
      <div className="modal-panel relative flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="pr-4">
            <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">{lead.nome_completo}</h3>
            <p className="text-xs text-slate-600 sm:text-sm">Histórico de Interações</p>
          </div>
          <div className="flex items-center gap-2">
            {!isObserver && (
              <button
                type="button"
                onClick={() => onEdit(lead)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-200"
              >
                <Pencil className="h-4 w-4" />
                <span className="hidden sm:inline">Editar Lead</span>
              </button>
            )}
            {!isObserver && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(lead)}
                className="inline-flex items-center gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-200"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Excluir</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-slate-100"
              aria-label="Fechar detalhes do lead"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-6 rounded-lg bg-slate-50 p-4">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="font-medium text-slate-700">Telefone:</span>
                <span className="ml-2 text-slate-900">{lead.telefone}</span>
              </div>
              {lead.email && (
                <div>
                  <span className="font-medium text-slate-700">E-mail:</span>
                  <span className="ml-2 text-slate-900">{lead.email}</span>
                </div>
              )}
              <div>
                <span className="font-medium text-slate-700">Status:</span>
                <span className="ml-2 text-slate-900">
                  {lead.status_nome ?? lead.status ?? 'Sem status'}
                </span>
              </div>
              <div>
                <span className="font-medium text-slate-700">Responsável:</span>
                <span className="ml-2 text-slate-900">
                  {lead.responsavel_label ?? lead.responsavel ?? 'Sem responsável'}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <NextStepSuggestion
              leadStatus={lead.status_nome ?? null}
              lastContact={lead.ultimo_contato}
            />
          </div>

          <div className="mb-6">
            <LeadStatusHistoryComponent leadId={lead.id} />
          </div>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="text-lg font-semibold text-slate-900">Interações</h4>
            {!isObserver && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Interação</span>
              </button>
            )}
          </div>

          {showForm && (
            <form onSubmit={handleAddInteraction} className="mb-6 rounded-lg bg-teal-50 p-4">
              <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo de Interação
                  </label>
                  <select
                    required
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Ligação">Ligação</option>
                    <option value="Mensagem">Mensagem</option>
                    <option value="E-mail">E-mail</option>
                    <option value="Reunião">Reunião</option>
                    <option value="Observação">Observação</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Responsável
                  </label>
                  <select
                    required
                    value={formData.responsavel}
                    onChange={(e) => setFormData({ ...formData, responsavel: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Luiza">Luiza</option>
                    <option value="Nick">Nick</option>
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descrição
                </label>
                <textarea
                  required
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                  placeholder="Descreva o que foi tratado nesta interação..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="w-full rounded-lg px-4 py-2 text-slate-700 transition-colors hover:bg-white sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-teal-600 px-4 py-2 text-white transition-colors hover:bg-teal-700 sm:w-auto"
                >
                  Adicionar
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
            </div>
          ) : interactions.length === 0 ? (
            <div className="rounded-lg bg-slate-50 py-12 text-center">
              <MessageCircle className="mx-auto mb-3 h-12 w-12 text-slate-300" />
              <p className="text-slate-600">Nenhuma interação registrada ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {interactions.map((interaction) => (
                <div key={interaction.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                        {interaction.tipo}
                      </span>
                      <span className="text-sm text-slate-600">{interaction.responsavel}</span>
                    </div>
                    <span className="text-xs text-slate-500 sm:text-sm">
                      {formatDateTimeFullBR(interaction.data_interacao)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 sm:text-base">{interaction.descricao}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
