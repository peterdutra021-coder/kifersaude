import { useEffect, useState } from 'react';
import { X, UserPlus, Phone, Mail, MapPin } from 'lucide-react';
import { Lead } from '../lib/supabase';
import { useConfig } from '../contexts/ConfigContext';

type LeadNotificationToastProps = {
  lead: Lead;
  onClose: () => void;
  onViewLead: () => void;
};

export default function LeadNotificationToast({
  lead,
  onClose,
  onViewLead,
}: LeadNotificationToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const statusLabel = lead.status ?? 'Não definido';
  const origemLabel = lead.origem ?? 'Não definida';
  const tipoContratacaoLabel = lead.tipo_contratacao ?? 'Não definido';
  const responsavelLabel = lead.responsavel ?? 'Não definido';

  useEffect(() => {
    const showTimer = setTimeout(() => setIsVisible(true), 100);

    const autoCloseTimer = setTimeout(() => {
      handleClose();
    }, 10000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(autoCloseTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleViewLead = () => {
    handleClose();
    onViewLead();
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        isVisible && !isExiting
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0'
      }`}
    >
      <div className="bg-white rounded-xl shadow-2xl border-2 border-teal-500 max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-white">
            <UserPlus className="w-5 h-5 animate-bounce" />
            <h3 className="font-bold text-lg">Novo Lead Recebido!</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-white hover:bg-teal-700 rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <p className="font-bold text-lg text-slate-900">{lead.nome_completo}</p>
            <p className="text-sm text-slate-600">
              Status:{' '}
              <span className="font-medium text-blue-600">
                {statusLabel}
              </span>
            </p>
          </div>

          <div className="space-y-2 text-sm text-slate-700">
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4 text-teal-600" />
              <span>{lead.telefone}</span>
            </div>

            {lead.email && (
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-teal-600" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}

            {lead.cidade && (
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-teal-600" />
                <span>{lead.cidade}</span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs text-slate-500 mb-2">
              <span className="font-medium">Origem:</span> {origemLabel} |
              <span className="font-medium ml-2">Tipo:</span> {tipoContratacaoLabel}
            </p>
            <p className="text-xs text-slate-500">
              <span className="font-medium">Responsável:</span> {responsavelLabel}
            </p>
          </div>

          <button
            onClick={handleViewLead}
            className="w-full bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors font-medium"
          >
            Ver Lead
          </button>
        </div>
      </div>
    </div>
  );
}
