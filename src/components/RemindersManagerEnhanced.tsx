import { useEffect, useRef, useState } from 'react';
import { supabase, Reminder, Lead, Contract } from '../lib/supabase';
import {
  Bell, Check, Trash2, AlertCircle, Calendar, Clock, Search,
  CheckSquare, Square, Timer, ExternalLink, BarChart3,
  ChevronDown, ChevronUp, Tag, X, MessageCircle, Loader2, MessageSquare,
  RefreshCw, Sparkles, Copy,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDateTimeFullBR, isOverdue } from '../lib/dateUtils';
import {
  groupRemindersByPeriod,
  getPeriodLabel,
  getPeriodColor,
  calculateSnoozeTime,
  getUrgencyLevel,
  getUrgencyStyles,
  formatEstimatedTime,
  ReminderPeriod
} from '../lib/reminderUtils';
import RemindersCalendar from './RemindersCalendar';
import ReminderSchedulerModal from './ReminderSchedulerModal';
import LeadForm from './LeadForm';
import { useConfirmationModal } from '../hooks/useConfirmationModal';

const getWhatsappLink = (phone: string | null | undefined) => {
  if (!phone) return null;

  const normalized = phone.replace(/\D/g, '');
  return normalized ? `https://wa.me/${normalized}` : null;
};

const normalizeLeadPhone = (phone: string | null | undefined) => phone?.replace(/\D/g, '') ?? '';

const formatHistoryTimestamp = (timestamp: number) => {
  const parsedTimestamp = String(timestamp).length <= 10 ? timestamp * 1000 : timestamp;
  const date = new Date(parsedTimestamp);

  if (Number.isNaN(date.getTime())) {
    return 'Data indisponível';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatInteractionDate = formatDateTimeFullBR;

export default function RemindersManagerEnhanced() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filter, setFilter] = useState<'todos' | 'nao-lidos' | 'lidos'>('nao-lidos');
  const [loading, setLoading] = useState(true);
  const [selectedReminders, setSelectedReminders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [showStats, setShowStats] = useState(false);
  const [expandedPeriods, setExpandedPeriods] = useState<Set<ReminderPeriod>>(
    new Set(['overdue', 'today', 'tomorrow'])
  );
  const [openSnoozeMenu, setOpenSnoozeMenu] = useState<string | null>(null);
  const [customSnoozeReminder, setCustomSnoozeReminder] = useState<string | null>(null);
  const [customSnoozeDateTime, setCustomSnoozeDateTime] = useState('');
  const [leadsMap, setLeadsMap] = useState<Map<string, Lead>>(new Map());
  const [showCalendar, setShowCalendar] = useState(false);
  const [contractsMap, setContractsMap] = useState<Map<string, Contract>>(new Map());
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [reminderPendingDeletion, setReminderPendingDeletion] = useState<Reminder | null>(null);
  const [isDeletingReminder, setIsDeletingReminder] = useState(false);
  const [manualReminderPrompt, setManualReminderPrompt] = useState<{
    lead: Lead;
    promptMessage: string;
    defaultTitle?: string;
    defaultDescription?: string;
    defaultType?: 'Retorno' | 'Follow-up' | 'Outro';
  } | null>(null);
  const { requestConfirmation, ConfirmationDialog } = useConfirmationModal();
  const pendingRefreshIdsRef = useRef<Set<string>>(new Set());
  const [historyModalData, setHistoryModalData] = useState<{
    phone: string;
    leadName?: string;
    leadId?: string;
  } | null>(null);
  const [historyMessages, setHistoryMessages] = useState<{
    id: string;
    body: string;
    timestamp: number;
    fromMe: boolean;
  }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [generatingFollowUp, setGeneratingFollowUp] = useState(false);
  const [generatedFollowUp, setGeneratedFollowUp] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUpCopied, setFollowUpCopied] = useState(false);
  const [followUpApproved, setFollowUpApproved] = useState(false);
  const [followUpBlocks, setFollowUpBlocks] = useState<string[]>([]);

  const getLeadIdForReminder = (reminder?: Reminder | null) => {
    if (!reminder) return null;
    if (reminder.lead_id) return reminder.lead_id;

    if (reminder.contract_id) {
      const contract = contractsMap.get(reminder.contract_id);
      if (contract?.lead_id) return contract.lead_id;
    }

    return null;
  };

  const closeHistoryModal = () => {
    setHistoryModalData(null);
    setHistoryMessages([]);
    setHistoryError(null);
    setHistoryLoading(false);
    setGeneratedFollowUp(null);
    setFollowUpError(null);
    setFollowUpCopied(false);
    setGeneratingFollowUp(false);
    setFollowUpApproved(false);
    setFollowUpBlocks([]);
  };

  const fetchHistoryMessages = async (phone: string) => {
    setHistoryLoading(true);
    setHistoryError(null);

    const chatId = `55${phone}@c.us`;
    const endpoint = 'https://sanford-subcorneous-prepositionally.ngrok-free.dev/chat/fetchMessages/f8377d8d-a589-4242-9ba6-9486a04ef80c';
    const headers = {
      'Content-Type': 'application/json',
      apikey: '292926',
    };

    try {
      const buildRequest = (fromMe: boolean) =>
        fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            chatId,
            searchOptions: {
              limit: 50,
              fromMe,
            },
          }),
        });

      const [receivedResponse, sentResponse] = await Promise.all([
        buildRequest(false),
        buildRequest(true),
      ]);

      if (!receivedResponse.ok || !sentResponse.ok) {
        const responses = [receivedResponse, sentResponse];
        const errorDetails = await Promise.all(responses.map(async (res) => `${res.status} ${res.statusText}`));
        throw new Error(errorDetails.join(' | '));
      }

      const parsePayload = async (response: Response) => {
        const content = await response.json();
        if (Array.isArray(content)) return content;
        if (Array.isArray(content?.messages)) return content.messages;
        if (Array.isArray(content?.data)) return content.data;
        return [];
      };

      const receivedMessages = await parsePayload(receivedResponse);
      const sentMessages = await parsePayload(sentResponse);

      const normalizeMessage = (message: any, index: number, fromMe: boolean) => {
        const timestampValue = Number(message?.timestamp ?? message?.t ?? message?.date ?? Date.now());
        return {
          id: String(message?.id ?? message?.key?.id ?? `${fromMe ? 'sent' : 'received'}-${index}`),
          body: String(message?.body ?? message?.message ?? message?.text ?? 'Mensagem sem texto'),
          timestamp: Number.isNaN(timestampValue) ? Date.now() : timestampValue,
          fromMe: Boolean(message?.fromMe ?? message?.from_me ?? message?.sent ?? fromMe),
        };
      };

      const normalizedMessages = [
        ...receivedMessages.map((message: any, index: number) => normalizeMessage(message, index, false)),
        ...sentMessages.map((message: any, index: number) => normalizeMessage(message, index, true)),
      ].sort((a, b) => a.timestamp - b.timestamp);

      setHistoryMessages(normalizedMessages);
    } catch (error) {
      console.error('Erro ao buscar histórico de mensagens do lead:', error);
      setHistoryMessages([]);
      setHistoryError('Não foi possível carregar o histórico de mensagens.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistoryModal = (leadName?: string, phone?: string | null, leadId?: string | null) => {
    const normalizedPhone = normalizeLeadPhone(phone);
    setHistoryModalData({
      phone: normalizedPhone,
      leadName,
      leadId: leadId ?? undefined,
    });
    setHistoryMessages([]);

    if (!normalizedPhone) {
      setHistoryError('Telefone do lead não disponível para buscar o histórico.');
      return;
    }

    setGeneratedFollowUp(null);
    setFollowUpError(null);
    setFollowUpCopied(false);
    setGeneratingFollowUp(false);

    void fetchHistoryMessages(normalizedPhone);
  };

  const buildConversationHistory = () => {
    if (historyMessages.length === 0) {
      return 'Nenhuma mensagem encontrada no histórico recente.';
    }

    const participantName = historyModalData?.leadName ?? 'Lead';

    return historyMessages
      .map(message => {
        const sender = message.fromMe ? 'Você' : participantName;
        return `- [${formatHistoryTimestamp(message.timestamp)}] ${sender}: ${message.body}`;
      })
      .join('\n');
  };

  const buildLeadContext = () => {
    if (!historyModalData?.leadId) return '';

    const leadData = leadsMap.get(historyModalData.leadId);

    if (!leadData) return '';

    return [
      `Telefone: ${leadData.telefone ?? 'Indisponível'}`,
      leadData.email ? `E-mail: ${leadData.email}` : null,
      `Status: ${leadData.status ?? leadData.status_nome ?? 'Sem status'}`,
      leadData.responsavel ? `Responsável: ${leadData.responsavel}` : null,
      leadData.ultimo_contato
        ? `Último contato: ${formatInteractionDate(leadData.ultimo_contato)}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleGenerateFollowUp = async () => {
    if (!historyModalData) return;

    setGeneratingFollowUp(true);
    setFollowUpError(null);
    setGeneratedFollowUp(null);
    setFollowUpCopied(false);
    setFollowUpApproved(false);
    setFollowUpBlocks([]);

    try {
      const conversationHistory = buildConversationHistory();
      const leadContext = buildLeadContext();

      const { data, error } = await supabase.functions.invoke<{ followUp?: string }>('generate-follow-up', {
        body: {
          leadName: historyModalData.leadName ?? 'Lead',
          conversationHistory,
          leadContext,
        },
      });

      if (error) throw error;

      if (!data?.followUp) {
        throw new Error('Resposta vazia do gerador de follow-up.');
      }

      setGeneratedFollowUp(data.followUp.trim());
    } catch (error) {
      console.error('Erro ao gerar follow-up:', error);
      setFollowUpError('Não foi possível gerar o follow-up automaticamente. Tente novamente em instantes.');
    } finally {
      setGeneratingFollowUp(false);
    }
  };

  const splitFollowUpIntoBlocks = (text: string) => {
    const normalized = text.trim().replace(/\r\n/g, '\n');
    const paragraphBlocks = normalized
      .split(/\n\s*\n/)
      .map(block => block.trim())
      .filter(Boolean);

    if (paragraphBlocks.length > 0) return paragraphBlocks;

    return normalized
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
  };

  const handleApproveFollowUp = () => {
    if (!generatedFollowUp) return;

    const blocks = splitFollowUpIntoBlocks(generatedFollowUp);
    setFollowUpBlocks(blocks);
    setFollowUpApproved(true);
  };

  const handleUpdateBlock = (index: number, value: string) => {
    setFollowUpBlocks(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleCopyFollowUp = async () => {
    if (!generatedFollowUp) return;

    try {
      await navigator.clipboard.writeText(generatedFollowUp);
      setFollowUpCopied(true);
      setTimeout(() => setFollowUpCopied(false), 2000);
    } catch (error) {
      console.error('Erro ao copiar follow-up:', error);
    }
  };

  useEffect(() => {
    loadReminders();

    const channel = supabase
      .channel('reminders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reminders'
        },
        payload => {
          const newReminder = payload.new as Reminder | null;
          const oldReminder = payload.old as Reminder | null;
          const affectedId = newReminder?.id ?? oldReminder?.id;

          if (affectedId && pendingRefreshIdsRef.current.has(affectedId)) {
            pendingRefreshIdsRef.current.delete(affectedId);
            return;
          }

          loadReminders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .order('data_lembrete', { ascending: true });

      if (error) throw error;
      setReminders(data || []);

      const contractIds = [...new Set((data || []).map(r => r.contract_id).filter(Boolean))];
      let fetchedContracts = [] as Contract[];

      if (contractIds.length > 0) {
        const { data: contractsData } = await supabase
          .from('contracts')
          .select('*')
          .in('id', contractIds);

        if (contractsData) {
          fetchedContracts = contractsData as Contract[];
          const newContractsMap = new Map();
          contractsData.forEach(contract => newContractsMap.set(contract.id, contract));
          setContractsMap(newContractsMap);
        }
      }

      const contractLeadIds = [
        ...new Set(
          fetchedContracts
            .map(contract => contract.lead_id)
            .filter(Boolean) as string[]
        ),
      ];

      const leadIds = [
        ...new Set([
          ...(data || []).map(r => r.lead_id).filter(Boolean),
          ...contractLeadIds,
        ]),
      ];

      if (leadIds.length > 0) {
        const { data: leadsData } = await supabase
          .from('leads')
          .select('*')
          .in('id', leadIds);

        if (leadsData) {
          const newLeadsMap = new Map();
          leadsData.forEach(lead => newLeadsMap.set(lead.id, lead));
          setLeadsMap(newLeadsMap);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar lembretes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadInfo = async (leadId: string) => {
    if (!leadId) {
      return null;
    }

    const cachedLead = leadsMap.get(leadId);
    if (cachedLead) {
      return cachedLead;
    }

    setLoadingLeadId(leadId);

    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      const leadData = data as Lead;

      setLeadsMap(current => {
        const next = new Map(current);
        next.set(leadData.id, leadData);
        return next;
      });

      return leadData;
    } catch (error) {
      console.error('Erro ao carregar dados do lead:', error);
      return null;
    } finally {
      setLoadingLeadId(null);
    }
  };

  const handleOpenLead = async (leadId: string) => {
    if (!leadId) {
      return;
    }

    const leadData = await fetchLeadInfo(leadId);

    if (!leadData) {
      alert('Não foi possível localizar os dados deste lead.');
      return;
    }

    setEditingLead(leadData);
  };

  const handleLeadSaved = () => {
    setEditingLead(null);
    loadReminders();
  };

  const updateLeadNextReturnDate = async (
    leadId: string,
    nextReturnDate: string | null,
    options?: { onlyIfMatches?: string }
  ) => {
    try {
      let query = supabase
        .from('leads')
        .update({ proximo_retorno: nextReturnDate })
        .eq('id', leadId);

      if (options?.onlyIfMatches) {
        query = query.eq('proximo_retorno', options.onlyIfMatches);
      }

      const { data, error } = await query
        .select('id, nome_completo, telefone, responsavel, proximo_retorno')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setLeadsMap(prev => {
          const next = new Map(prev);
          const existing = next.get(leadId);
          next.set(leadId, existing ? { ...existing, ...data } : (data as Lead));
          return next;
        });
      }
    } catch (error) {
      console.error('Erro ao sincronizar próximo retorno do lead:', error);
    }
  };

  const handleMarkAsRead = async (id: string, currentStatus: boolean) => {
    try {
      const reminder = reminders.find(r => r.id === id);
      const leadId = getLeadIdForReminder(reminder);
      const completionDate = !currentStatus ? new Date().toISOString() : null;
      const updateData: Pick<Reminder, 'lido' | 'concluido_em'> = {
        lido: !currentStatus,
        concluido_em: completionDate ?? undefined,
      };

      const { error } = await supabase
        .from('reminders')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      if (completionDate && leadId) {
        let leadInfo = leadsMap.get(leadId);

        if (!leadInfo) {
          const { data: leadData } = await supabase
            .from('leads')
            .select('id, nome_completo, telefone, responsavel, proximo_retorno')
            .eq('id', leadId)
            .maybeSingle();

          if (leadData) {
            leadInfo = leadData as Lead;
            setLeadsMap(prev => {
              const next = new Map(prev);
              next.set(leadInfo!.id, leadInfo!);
              return next;
            });
          }
        }

        if (leadInfo && reminder) {
          await updateLeadNextReturnDate(leadId, null, {
            onlyIfMatches: reminder.data_lembrete,
          });

          setManualReminderPrompt({
            lead: leadInfo,
            promptMessage: 'Deseja marcar um próximo lembrete para este lead?',
            defaultTitle: reminder.titulo,
            defaultDescription: reminder.descricao ?? undefined,
            defaultType: 'Follow-up',
          });
        }
      }
      setReminders(currentReminders =>
        currentReminders.map(reminderItem =>
          reminderItem.id === id
            ? {
                ...reminderItem,
                lido: !currentStatus,
                concluido_em: completionDate ?? undefined,
              }
            : reminderItem
        )
      );
      setSelectedReminders(prev => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      pendingRefreshIdsRef.current.add(id);
    } catch (error) {
      console.error('Erro ao atualizar lembrete:', error);
      alert('Erro ao atualizar lembrete');
    }
  };

  const handleDelete = (id: string) => {
    const reminder = reminders.find(item => item.id === id);
    if (reminder) {
      setReminderPendingDeletion(reminder);
    }
  };

  const confirmDeleteReminder = async () => {
    if (!reminderPendingDeletion) return;

    const reminderToDelete = reminderPendingDeletion;

    setIsDeletingReminder(true);
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', reminderToDelete.id);

      if (error) throw error;
      setReminders(currentReminders => currentReminders.filter(reminder => reminder.id !== reminderToDelete.id));
      setSelectedReminders(prev => {
        if (!prev.has(reminderToDelete.id)) return prev;
        const next = new Set(prev);
        next.delete(reminderToDelete.id);
        return next;
      });
      pendingRefreshIdsRef.current.add(reminderToDelete.id);

      if (reminderToDelete.lead_id) {
        await updateLeadNextReturnDate(reminderToDelete.lead_id, null, {
          onlyIfMatches: reminderToDelete.data_lembrete,
        });
      }
    } catch (error) {
      console.error('Erro ao remover lembrete:', error);
      alert('Erro ao remover lembrete');
    } finally {
      setIsDeletingReminder(false);
      setReminderPendingDeletion(null);
    }
  };

  const handleSnooze = async (reminder: Reminder, option: 'minutes-15' | 'minutes-30' | 'hour-1' | 'tomorrow' | 'next-week') => {
    try {
      const newDate = calculateSnoozeTime(option);
      const currentSnoozeCount = reminder.snooze_count || 0;

      const { error } = await supabase
        .from('reminders')
        .update({
          data_lembrete: newDate,
          snooze_count: currentSnoozeCount + 1
        })
        .eq('id', reminder.id);

      if (error) throw error;
      if (reminder.lead_id) {
        await updateLeadNextReturnDate(reminder.lead_id, newDate);
      }
      setOpenSnoozeMenu(null);
      loadReminders();
    } catch (error) {
      console.error('Erro ao adiar lembrete:', error);
      alert('Erro ao adiar lembrete');
    }
  };

  const handleCustomSnooze = async () => {
    if (!customSnoozeReminder || !customSnoozeDateTime) return;

    try {
      const reminder = reminders.find(r => r.id === customSnoozeReminder);
      if (!reminder) return;

      const currentSnoozeCount = reminder.snooze_count || 0;

      const newDate = new Date(customSnoozeDateTime).toISOString();

      const { error } = await supabase
        .from('reminders')
        .update({
          data_lembrete: newDate,
          snooze_count: currentSnoozeCount + 1
        })
        .eq('id', customSnoozeReminder);

      if (error) throw error;
      if (reminder.lead_id) {
        await updateLeadNextReturnDate(reminder.lead_id, newDate);
      }
      setCustomSnoozeReminder(null);
      setCustomSnoozeDateTime('');
      setOpenSnoozeMenu(null);
      loadReminders();
    } catch (error) {
      console.error('Erro ao adiar lembrete:', error);
      alert('Erro ao adiar lembrete');
    }
  };

  const handleBatchMarkAsRead = async () => {
    if (selectedReminders.size === 0) return;

    try {
      const remindersToUpdate = reminders.filter(
        reminder => selectedReminders.has(reminder.id) && !reminder.lido
      );
      const completionDate = new Date().toISOString();

      const { error } = await supabase
        .from('reminders')
        .update({
          lido: true,
          concluido_em: completionDate
        })
        .in('id', Array.from(selectedReminders));

      if (error) throw error;

      const leadUpdates = remindersToUpdate
        .map(reminder => ({ reminder, leadId: getLeadIdForReminder(reminder) }))
        .filter(({ leadId }) => Boolean(leadId))
        .map(({ reminder, leadId }) =>
          updateLeadNextReturnDate(leadId!, null, {
            onlyIfMatches: reminder.data_lembrete,
          })
        );

      await Promise.all(leadUpdates);

      if (remindersToUpdate.length === 1) {
        const [completedReminder] = remindersToUpdate;
        const leadId = getLeadIdForReminder(completedReminder);
        if (leadId) {
          let leadInfo = leadsMap.get(leadId);

          if (!leadInfo) {
            const { data: leadData } = await supabase
              .from('leads')
              .select('id, nome_completo, telefone, responsavel, proximo_retorno')
              .eq('id', leadId)
              .maybeSingle();

            if (leadData) {
              leadInfo = leadData as Lead;
              setLeadsMap(prev => {
                const next = new Map(prev);
                next.set(leadInfo!.id, leadInfo!);
                return next;
              });
            }
          }

          if (leadInfo) {
            setManualReminderPrompt({
              lead: leadInfo,
              promptMessage: 'Deseja marcar um próximo lembrete para este lead?',
              defaultTitle: completedReminder.titulo,
              defaultDescription: completedReminder.descricao ?? undefined,
              defaultType: 'Follow-up',
            });
          }
        }
      }

      setSelectedReminders(new Set());
      loadReminders();
    } catch (error) {
      console.error('Erro ao atualizar lembretes:', error);
      alert('Erro ao atualizar lembretes');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedReminders.size === 0) return;
    const confirmed = await requestConfirmation({
      title: 'Excluir lembretes selecionados',
      description: `Deseja remover ${selectedReminders.size} lembrete(s)? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir lembretes',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      const reminderIds = Array.from(selectedReminders);
      const remindersToDelete = reminders.filter(reminder => reminderIds.includes(reminder.id));

      const { error } = await supabase
        .from('reminders')
        .delete()
        .in('id', reminderIds);

      if (error) throw error;
      setSelectedReminders(new Set());
      const leadUpdates = remindersToDelete
        .filter(reminder => reminder.lead_id)
        .map(reminder =>
          updateLeadNextReturnDate(reminder.lead_id!, null, { onlyIfMatches: reminder.data_lembrete })
        );
      await Promise.all(leadUpdates);
      loadReminders();
    } catch (error) {
      console.error('Erro ao remover lembretes:', error);
      alert('Erro ao remover lembretes');
    }
  };

  const handleMarkAllAsRead = async () => {
    const confirmed = await requestConfirmation({
      title: 'Marcar lembretes como lidos',
      description: 'Deseja marcar todos os lembretes não lidos como lidos?',
      confirmLabel: 'Marcar como lidos',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          lido: true,
          concluido_em: new Date().toISOString()
        })
        .eq('lido', false);

      if (error) throw error;
      loadReminders();
    } catch (error) {
      console.error('Erro ao atualizar lembretes:', error);
      alert('Erro ao atualizar lembretes');
    }
  };

  const toggleReminderSelection = (id: string) => {
    const newSelection = new Set(selectedReminders);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedReminders(newSelection);
  };

  const togglePeriod = (period: ReminderPeriod) => {
    const newExpanded = new Set(expandedPeriods);
    if (newExpanded.has(period)) {
      newExpanded.delete(period);
    } else {
      newExpanded.add(period);
    }
    setExpandedPeriods(newExpanded);
  };

  const filteredReminders = reminders.filter(reminder => {
    if (filter === 'nao-lidos' && reminder.lido) {
      return false;
    }
    if (filter === 'lidos' && !reminder.lido) {
      return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        reminder.titulo.toLowerCase().includes(query) ||
        (reminder.descricao && reminder.descricao.toLowerCase().includes(query)) ||
        reminder.tipo.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    if (typeFilter !== 'all' && reminder.tipo !== typeFilter) {
      return false;
    }

    if (priorityFilter !== 'all' && reminder.prioridade !== priorityFilter) {
      return false;
    }

    return true;
  });

  const groupedReminders = groupRemindersByPeriod(filteredReminders);

  const stats = {
    total: reminders.length,
    unread: reminders.filter(r => !r.lido).length,
    overdue: reminders.filter(r => isOverdue(r.data_lembrete) && !r.lido).length,
    today: groupedReminders.today.length,
    completed: reminders.filter(r => r.lido).length
  };

  const getPriorityColor = (prioridade: string) => {
    const colors: Record<string, string> = {
      'baixa': 'bg-blue-100 text-blue-700',
      'normal': 'bg-slate-100 text-slate-700',
      'alta': 'bg-red-100 text-red-700',
    };
    return colors[prioridade] || 'bg-slate-100 text-slate-700';
  };

  const getTipoIcon = (tipo: string) => {
    const icons: Record<string, LucideIcon> = {
      'Documentos pendentes': AlertCircle,
      'Assinatura': AlertCircle,
      'Ativação': Calendar,
      'Renovação': Calendar,
      'Retorno': Bell,
    };
    const Icon = icons[tipo] || Bell;
    return <Icon className="w-5 h-5" />;
  };

  const renderReminderCard = (reminder: Reminder) => {
    const overdue = isOverdue(reminder.data_lembrete);
    const urgency = getUrgencyLevel(reminder);
    const isSelected = selectedReminders.has(reminder.id);
    const contract = reminder.contract_id ? contractsMap.get(reminder.contract_id) : undefined;
    const leadInfo = reminder.lead_id
      ? leadsMap.get(reminder.lead_id)
      : contract?.lead_id
        ? leadsMap.get(contract.lead_id)
        : undefined;
    const whatsappLink = getWhatsappLink(leadInfo?.telefone);

    return (
      <div
        key={reminder.id}
        className={`bg-white rounded-xl shadow-sm border p-5 transition-all ${
          reminder.lido
            ? 'border-slate-200 opacity-60'
            : `${getUrgencyStyles(urgency)}`
        } ${isSelected ? 'ring-2 ring-teal-500' : ''}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 flex-1">
            <button
              onClick={() => toggleReminderSelection(reminder.id)}
              className="mt-1 text-slate-400 hover:text-teal-600 transition-colors"
            >
              {isSelected ? (
                <CheckSquare className="w-5 h-5 text-teal-600" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>

            <div className={`p-3 rounded-lg ${
              reminder.lido
                ? 'bg-slate-100 text-slate-500'
                : overdue
                ? 'bg-red-100 text-red-600'
                : 'bg-teal-100 text-teal-600'
            }`}>
              {getTipoIcon(reminder.tipo)}
            </div>

            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  {reminder.titulo}
                </h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(reminder.prioridade)}`}>
                  {reminder.prioridade}
                </span>
                <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
                  {reminder.tipo}
                </span>
                {reminder.tempo_estimado_minutos && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center space-x-1">
                    <Timer className="w-3 h-3" />
                    <span>{formatEstimatedTime(reminder.tempo_estimado_minutos)}</span>
                  </span>
                )}
              </div>

              {reminder.descricao && (
                <p className="text-slate-600 mb-3 text-sm">{reminder.descricao}</p>
              )}

              {reminder.tags && reminder.tags.length > 0 && (
                <div className="flex items-center space-x-2 mb-3">
                  {reminder.tags.map((tag, index) => (
                    <span key={index} className="flex items-center space-x-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                      <Tag className="w-3 h-3" />
                      <span>{tag}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center space-x-4 text-sm text-slate-500">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDateTimeFullBR(reminder.data_lembrete)}</span>
                </div>
                {overdue && !reminder.lido && (
                  <span className="text-red-600 font-medium">Atrasado </span>
                )}
                {typeof reminder.snooze_count === 'number' && reminder.snooze_count > 0 && (
                  <span className="text-orange-600 text-xs">
                    Adiado {reminder.snooze_count}x
                  </span>
                )}
                {(reminder.lead_id || reminder.contract_id) && (
                  <ReminderContextLink
                    leadId={reminder.lead_id ?? contract?.lead_id}
                    contractId={reminder.contract_id}
                    leadName={leadInfo?.nome_completo}
                    onLeadClick={handleOpenLead}
                    isLoading={loadingLeadId === reminder.lead_id}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => openHistoryModal(leadInfo?.nome_completo, leadInfo?.telefone, reminder.lead_id ?? contract?.lead_id ?? null)}
              disabled={!leadInfo?.telefone}
              className={`p-2 rounded-lg transition-colors ${
                leadInfo?.telefone
                  ? 'text-slate-700 hover:bg-slate-100'
                  : 'text-slate-400 cursor-not-allowed'
              }`}
              title={leadInfo?.telefone ? 'Ver histórico de mensagens' : 'Telefone não disponível'}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Abrir conversa no WhatsApp"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            )}
            {!reminder.lido && (
              <div className="relative">
                <button
                  onClick={() => setOpenSnoozeMenu(openSnoozeMenu === reminder.id ? null : reminder.id)}
                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                  title="Adiar"
                >
                  <Clock className="w-5 h-5" />
                </button>
                {openSnoozeMenu === reminder.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOpenSnoozeMenu(null)}
                    />
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-20 min-w-[180px]">
                      <button
                        onClick={() => handleSnooze(reminder, 'minutes-15')}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                      >
                        15 minutos
                      </button>
                      <button
                        onClick={() => handleSnooze(reminder, 'minutes-30')}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                      >
                        30 minutos
                      </button>
                      <button
                        onClick={() => handleSnooze(reminder, 'hour-1')}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                      >
                        1 hora
                      </button>
                      <button
                        onClick={() => handleSnooze(reminder, 'tomorrow')}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                      >
                        Amanhã às 9h
                      </button>
                      <button
                        onClick={() => handleSnooze(reminder, 'next-week')}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
                      >
                        Próxima semana
                      </button>
                      <div className="border-t border-slate-200 my-2"></div>
                      <button
                        onClick={() => {
                          setCustomSnoozeReminder(reminder.id);
                          setOpenSnoozeMenu(null);
                          const now = new Date();
                          now.setMinutes(now.getMinutes() + 30);
                          setCustomSnoozeDateTime(now.toISOString().slice(0, 16));
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors text-teal-600 font-medium"
                      >
                        Personalizado...
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => handleMarkAsRead(reminder.id, reminder.lido)}
              className={`p-2 rounded-lg transition-colors ${
                reminder.lido
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-green-600 hover:bg-green-50'
              }`}
              title={reminder.lido ? 'Marcar como não lido' : 'Marcar como lido'}
            >
              <Check className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleDelete(reminder.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remover"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Lembretes e Notificações</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowCalendar(true)}
            className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            title="Ver Calendário"
          >
            <Calendar className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowStats(!showStats)}
            className={`p-2 rounded-lg transition-colors ${
              showStats ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            title="Estatísticas"
          >
            <BarChart3 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setFilter('nao-lidos')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'nao-lidos'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Não Lidos ({stats.unread})
          </button>
          <button
            onClick={() => setFilter('todos')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'todos'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Todos ({stats.total})
          </button>
          <button
            onClick={() => setFilter('lidos')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === 'lidos'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Lidos ({stats.completed})
          </button>
        </div>
      </div>

      {showStats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">Total</div>
            <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">Não Lidos</div>
            <div className="text-3xl font-bold text-orange-600">{stats.unread}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">Atrasados</div>
            <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">Hoje</div>
            <div className="text-3xl font-bold text-teal-600">{stats.today}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="text-sm text-slate-600 mb-1">Concluídos</div>
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:space-x-4 sm:gap-0">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar lembretes por título, descrição ou tipo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent sm:w-48"
          >
            <option value="all">Todos os tipos</option>
            <option value="Documentos pendentes">Documentos pendentes</option>
            <option value="Assinatura">Assinatura</option>
            <option value="Ativação">Ativação</option>
            <option value="Renovação">Renovação</option>
            <option value="Retorno">Retorno</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent sm:w-40"
          >
            <option value="all">Todas prioridades</option>
            <option value="baixa">Baixa</option>
            <option value="normal">Normal</option>
            <option value="alta">Alta</option>
          </select>

          <button
            onClick={() => setViewMode(viewMode === 'grouped' ? 'list' : 'grouped')}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            {viewMode === 'grouped' ? 'Lista' : 'Agrupar'}
          </button>
        </div>

        {selectedReminders.size > 0 && (
          <div className="flex items-center space-x-3 pt-4 border-t border-slate-200">
            <span className="text-sm text-slate-600 font-medium">
              {selectedReminders.size} selecionado(s)
            </span>
            <button
              onClick={handleBatchMarkAsRead}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Marcar como lido
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Excluir
            </button>
            <button
              onClick={() => setSelectedReminders(new Set())}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm"
            >
              Cancelar
            </button>
            {filter === 'nao-lidos' && stats.unread > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="ml-auto px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm"
              >
                Marcar todos como lido
              </button>
            )}
          </div>
        )}
      </div>

      {filteredReminders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
          <Bell className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Nenhum lembrete encontrado</h3>
          <p className="text-slate-600">
            {searchQuery || typeFilter !== 'all' || priorityFilter !== 'all'
              ? 'Tente ajustar os filtros de busca'
              : filter === 'nao-lidos'
              ? 'Você não tem lembretes pendentes'
              : filter === 'lidos'
              ? 'Você não tem lembretes lidos'
              : 'Você não tem lembretes cadastrados'}
          </p>
        </div>
      ) : viewMode === 'grouped' ? (
        <div className="space-y-6">
          {(['overdue', 'today', 'tomorrow', 'thisWeek', 'thisMonth', 'later'] as ReminderPeriod[]).map(period => {
            const periodReminders = groupedReminders[period];
            if (periodReminders.length === 0) return null;

            const isExpanded = expandedPeriods.has(period);

            return (
              <div key={period} className={`border rounded-xl ${getPeriodColor(period)}`}>
                <button
                  onClick={() => togglePeriod(period)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/50 transition-colors rounded-xl"
                >
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {getPeriodLabel(period)}
                    </h3>
                    <span className="px-3 py-1 bg-white rounded-full text-sm font-medium text-slate-700">
                      {periodReminders.length}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-slate-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-600" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {periodReminders.map(renderReminderCard)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReminders.map(renderReminderCard)}
        </div>
      )}

      {historyModalData && (
        <div className="fixed inset-0 bg-black/50 flex items-stretch justify-center z-50 p-0 sm:items-center sm:p-4">
          <div className="modal-panel bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden min-h-0">
            <div className="flex items-start justify-between p-5 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Histórico de mensagens</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {historyModalData.leadName ?? 'Lead sem nome'} · {historyModalData.phone || 'Telefone indisponível'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => historyModalData.phone && fetchHistoryMessages(historyModalData.phone)}
                  disabled={!historyModalData.phone || historyLoading}
                  className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${historyLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
                <button
                  type="button"
                  onClick={closeHistoryModal}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                  <span className="sr-only">Fechar</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
              <div className="modal-panel-content h-full overflow-y-auto bg-slate-50 p-5 space-y-3 min-h-0">
                {historyLoading ? (
                  <div className="flex h-full items-center justify-center text-slate-600">
                    <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
                    <span className="ml-2 text-sm">Carregando histórico...</span>
                  </div>
                ) : historyError ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {historyError}
                  </div>
                ) : historyMessages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-slate-500">
                    <MessageSquare className="h-10 w-10 text-slate-300" />
                    <p className="mt-2 text-sm font-semibold text-slate-700">Nenhuma mensagem encontrada.</p>
                    <p className="text-xs">As últimas 50 mensagens enviadas e recebidas aparecerão aqui.</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {historyMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-2xl border px-4 py-3 shadow-sm ${
                              message.fromMe
                                ? 'bg-teal-50 border-teal-100 text-slate-800'
                                : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                            <p className="mt-2 text-[11px] text-slate-500 text-right">
                              {message.fromMe ? 'Você · ' : ''}
                              {formatHistoryTimestamp(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-slate-900">
                            <Sparkles className="h-5 w-5 text-teal-600" />
                            <span className="font-semibold">Gerar follow-up com IA</span>
                          </div>
                          <p className="text-sm text-slate-600">
                            Use o histórico acima para criar uma resposta rápida de retorno.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleGenerateFollowUp}
                          disabled={generatingFollowUp}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-70 sm:w-auto"
                        >
                          {generatingFollowUp ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                          <span>{generatingFollowUp ? 'Gerando...' : 'Gerar follow-up'}</span>
                        </button>
                      </div>

                      {followUpError && (
                        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{followUpError}</p>
                      )}

                      {generatedFollowUp && (
                        <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-sm font-semibold text-slate-900">Sugestão pronta para envio</span>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={handleGenerateFollowUp}
                                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                              >
                                <RefreshCw className="h-4 w-4" />
                                <span>Gerar outro</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleCopyFollowUp}
                                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-white"
                              >
                                {followUpCopied ? (
                                  <>
                                    <Check className="h-4 w-4 text-teal-600" />
                                    <span>Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-4 w-4" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={handleApproveFollowUp}
                                className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
                              >
                                <Check className="h-4 w-4" />
                                <span>Aprovar e dividir em blocos</span>
                              </button>
                            </div>
                          </div>

                          <p className="whitespace-pre-wrap text-sm text-slate-800">{generatedFollowUp}</p>

                          {followUpApproved && followUpBlocks.length > 0 && (
                            <div className="space-y-3 rounded-lg border border-teal-100 bg-white p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">Enviar em blocos sequenciais</p>
                                  <p className="text-xs text-slate-600">Revise os textos abaixo e envie no WhatsApp seguindo a ordem.</p>
                                </div>
                                {!historyModalData?.phone && (
                                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">Telefone indisponível</span>
                                )}
                              </div>

                              <div className="space-y-2">
                                {followUpBlocks.map((block, index) => {
                                  const whatsappBase = historyModalData?.phone ? getWhatsappLink(historyModalData.phone) : null;
                                  const whatsappLink = whatsappBase
                                    ? `${whatsappBase}?text=${encodeURIComponent(block)}`
                                    : null;

                                  return (
                                    <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-slate-800">Mensagem {index + 1}</span>
                                        {whatsappLink ? (
                                          <a
                                            href={whatsappLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-green-700"
                                          >
                                            <MessageCircle className="h-4 w-4" />
                                            <span>Enviar no WhatsApp</span>
                                          </a>
                                        ) : (
                                          <span className="text-[11px] text-slate-500">Telefone não disponível</span>
                                        )}
                                      </div>

                                      <textarea
                                        value={block}
                                        onChange={(event) => handleUpdateBlock(index, event.target.value)}
                                        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-200"
                                        rows={3}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
              Mensagens exibidas conforme retorno da integração externa.
            </div>
          </div>
        </div>
      )}

      {reminderPendingDeletion && (
        <div className="fixed inset-0 bg-black/50 flex items-stretch justify-center z-50 p-0 sm:items-center sm:p-4">
          <div className="modal-panel bg-white rounded-xl shadow-2xl max-w-md w-full p-6 flex flex-col">
            <div className="flex items-start space-x-3">
              <div className="p-3 rounded-full bg-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Remover lembrete</h3>
                <p className="text-sm text-slate-600 mt-1">
                  Tem certeza que deseja remover o lembrete
                  <span className="font-semibold text-slate-900"> "{reminderPendingDeletion.titulo}"</span>?
                  Esta ação não pode ser desfeita.
                </p>
                {reminderPendingDeletion.descricao && (
                  <p className="mt-2 text-xs text-slate-500 break-words">
                    {reminderPendingDeletion.descricao}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setReminderPendingDeletion(null)}
                disabled={isDeletingReminder}
                className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteReminder}
                disabled={isDeletingReminder}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeletingReminder ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {customSnoozeReminder && (
        <div className="fixed inset-0 bg-black/50 flex items-stretch justify-center z-50 p-0 sm:items-center sm:p-4">
          <div className="modal-panel bg-white rounded-xl shadow-2xl max-w-md w-full p-6 flex flex-col">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Adiar para data/hora personalizada</h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Data e Hora
              </label>
              <input
                type="datetime-local"
                value={customSnoozeDateTime}
                onChange={(e) => setCustomSnoozeDateTime(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setCustomSnoozeReminder(null);
                  setCustomSnoozeDateTime('');
                }}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleCustomSnooze}
                disabled={!customSnoozeDateTime}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adiar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCalendar && (
        <RemindersCalendar
          reminders={reminders}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {manualReminderPrompt && (
        <ReminderSchedulerModal
          lead={manualReminderPrompt.lead}
          onClose={() => setManualReminderPrompt(null)}
          onScheduled={({ reminderDate }) => {
            const { lead } = manualReminderPrompt;
            setManualReminderPrompt(null);
            setLeadsMap(prev => {
              const next = new Map(prev);
              next.set(lead.id, { ...lead, proximo_retorno: reminderDate });
              return next;
            });
            loadReminders();
          }}
          promptMessage={manualReminderPrompt.promptMessage}
          defaultTitle={manualReminderPrompt.defaultTitle}
          defaultDescription={manualReminderPrompt.defaultDescription}
          defaultType={manualReminderPrompt.defaultType}
        />
      )}

      {loadingLeadId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="flex items-center space-x-2 rounded-lg bg-white px-4 py-3 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
            <span className="text-sm font-medium text-slate-700">Carregando lead...</span>
          </div>
        </div>
      )}

      {editingLead && (
        <LeadForm
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSave={handleLeadSaved}
        />
      )}
      {ConfirmationDialog}
    </div>
  );
}

type ReminderContextLinkProps = {
  leadId?: string;
  contractId?: string;
  leadName?: string;
  onLeadClick?: (leadId: string) => void;
  isLoading?: boolean;
};

type ContextInfo =
  | { type: 'lead'; label: string }
  | { type: 'contract'; label: string };

function ReminderContextLink({
  leadId,
  contractId,
  leadName,
  onLeadClick,
  isLoading,
}: ReminderContextLinkProps) {
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);

  useEffect(() => {
    const loadContext = async () => {
      if (leadId) {
        if (leadName) {
          setContextInfo({ type: 'lead', label: leadName });
          return;
        }

        const { data } = await supabase
          .from('leads')
          .select('nome_completo')
          .eq('id', leadId)
          .maybeSingle();

        if (data) {
          setContextInfo({ type: 'lead', label: data.nome_completo });
        }
      } else if (contractId) {
        const { data } = await supabase
          .from('contracts')
          .select('codigo_contrato')
          .eq('id', contractId)
          .maybeSingle();

        if (data) {
          setContextInfo({ type: 'contract', label: data.codigo_contrato });
        }
      } else {
        setContextInfo(null);
      }
    };

    loadContext();
  }, [leadId, contractId, leadName]);

  if (!contextInfo) return null;

  const baseClassName = 'flex items-center space-x-1 text-xs text-teal-600';

  if (contextInfo.type === 'lead' && leadId) {
    if (isLoading) {
      return (
        <span className={baseClassName}>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Carregando lead...</span>
        </span>
      );
    }

    if (onLeadClick) {
      return (
        <button
          type="button"
          onClick={() => onLeadClick(leadId)}
          className={`${baseClassName} hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 rounded transition-colors`}
        >
          <ExternalLink className="w-3 h-3" />
          <span>Lead: {contextInfo.label}</span>
        </button>
      );
    }

    return (
      <span className={baseClassName}>
        <ExternalLink className="w-3 h-3" />
        <span>Lead: {contextInfo.label}</span>
      </span>
    );
  }

  return (
    <span className={baseClassName}>
      <ExternalLink className="w-3 h-3" />
      <span>Contrato: {contextInfo.label}</span>
    </span>
  );
}
