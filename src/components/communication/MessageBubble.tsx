import { useState } from 'react';
import { Check, CheckCheck, Clock, AlertCircle, Edit3, Trash2, History } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageHistoryModal } from './MessageHistoryModal';

interface MessageBubbleProps {
  id: string;
  body: string | null;
  type: string | null;
  direction: 'inbound' | 'outbound';
  timestamp: string | null;
  ackStatus: number | null;
  hasMedia: boolean;
  fromName?: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
  editCount?: number;
  editedAt?: string | null;
  originalBody?: string | null;
  onReply?: (messageId: string, body: string, from: string) => void;
  onEdit?: (messageId: string, body: string) => void;
}

export function MessageBubble({
  id,
  body,
  type,
  direction,
  timestamp,
  ackStatus,
  hasMedia,
  fromName,
  isDeleted = false,
  deletedAt,
  editCount = 0,
  editedAt,
  originalBody,
  onReply,
  onEdit,
}: MessageBubbleProps) {
  const isOutbound = direction === 'outbound';
  const [showHistory, setShowHistory] = useState(false);
  const hasHistory = editCount > 0 || isDeleted;

  const formatTimestamp = (ts: string | null) => {
    if (!ts) return '';

    const date = new Date(ts);

    if (isToday(date)) {
      return format(date, 'HH:mm', { locale: ptBR });
    } else if (isYesterday(date)) {
      return `Ontem ${format(date, 'HH:mm', { locale: ptBR })}`;
    } else {
      return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
    }
  };

  const getAckIcon = () => {
    if (ackStatus === null || !isOutbound) return null;

    switch (ackStatus) {
      case 0:
        return <Clock className="w-3 h-3 text-gray-400" />;
      case 1:
        return <Check className="w-3 h-3 text-gray-400" />;
      case 2:
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case 3:
      case 4:
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      default:
        return <AlertCircle className="w-3 h-3 text-red-500" />;
    }
  };

  const getAckLabel = () => {
    if (ackStatus === null) return '';

    switch (ackStatus) {
      case 0:
        return 'Enviando';
      case 1:
        return 'Enviado';
      case 2:
        return 'Entregue';
      case 3:
        return 'Lido';
      case 4:
        return 'Ouvido';
      default:
        return '';
    }
  };

  const renderContent = () => {
    if (isDeleted) {
      return (
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-500 flex-shrink-0" />
          <div className="text-sm italic text-gray-600">
            <span className="line-through">Mensagem apagada</span>
            {deletedAt && (
              <span className="block text-xs mt-1">
                em {format(new Date(deletedAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
              </span>
            )}
          </div>
        </div>
      );
    }

    if (type === 'location') {
      return (
        <div className="flex items-center gap-2">
          <div className="text-sm">
            <div className="font-medium">Localização compartilhada</div>
            <a
              href={`https://maps.google.com/?q=${body}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline text-xs"
            >
              Ver no mapa
            </a>
          </div>
        </div>
      );
    }

    if (hasMedia && type?.startsWith('image')) {
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                📷
              </div>
              <div>
                <div className="font-medium">Imagem</div>
                <div className="text-xs">Clique para visualizar</div>
              </div>
            </div>
          </div>
          {body && <div className="text-sm">{body}</div>}
        </div>
      );
    }

    if (hasMedia && type?.startsWith('audio') || type === 'ptt') {
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                🎤
              </div>
              <div className="flex-1">
                <div className="font-medium">Áudio</div>
                <div className="text-xs">Clique para ouvir</div>
              </div>
            </div>
          </div>
          {body && <div className="text-sm">{body}</div>}
        </div>
      );
    }

    if (hasMedia && type === 'document') {
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                📄
              </div>
              <div>
                <div className="font-medium">Documento</div>
                <div className="text-xs">Clique para baixar</div>
              </div>
            </div>
          </div>
          {body && <div className="text-sm">{body}</div>}
        </div>
      );
    }

    if (hasMedia) {
      return (
        <div className="space-y-2">
          <div className="bg-gray-100 rounded p-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                📎
              </div>
              <div>
                <div className="font-medium">Anexo</div>
                <div className="text-xs">{type || 'Arquivo'}</div>
              </div>
            </div>
          </div>
          {body && <div className="text-sm">{body}</div>}
        </div>
      );
    }

    return <div className="text-sm whitespace-pre-wrap break-words">{body || '(mensagem vazia)'}</div>;
  };

  return (
    <div
      className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-2 group`}
    >
      <div className={`max-w-[70%] ${isOutbound ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-lg px-3 py-2 ${
            isOutbound
              ? 'bg-green-100 text-gray-900'
              : 'bg-white text-gray-900 border border-gray-200'
          }`}
        >
          {!isOutbound && fromName && (
            <div className="text-xs font-semibold text-green-600 mb-1">
              {fromName}
            </div>
          )}

          {renderContent()}

          <div className="flex items-center justify-between gap-2 mt-1">
            <div className="flex items-center gap-2">
              {editCount > 0 && !isDeleted && (
                <div
                  className="flex items-center gap-1 text-xs text-blue-600 cursor-pointer hover:text-blue-700"
                  title={`Editada ${editCount} vez${editCount > 1 ? 'es' : ''}`}
                  onClick={() => setShowHistory(true)}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Editada</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">
                {formatTimestamp(timestamp)}
              </span>
              {isOutbound && (
                <span title={getAckLabel()}>
                  {getAckIcon()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1">
          {onReply && !isDeleted && (
            <button
              onClick={() => onReply(id, body || '', fromName || 'Contato')}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 hover:text-gray-700 px-2"
            >
              Responder
            </button>
          )}

          {onEdit && isOutbound && !isDeleted && !hasMedia && (
            <button
              onClick={() => onEdit(id, body || '')}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 hover:text-gray-700 px-2 flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              <span>Editar</span>
            </button>
          )}

          {hasHistory && (
            <button
              onClick={() => setShowHistory(true)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-blue-600 hover:text-blue-700 px-2 flex items-center gap-1"
            >
              <History className="w-3 h-3" />
              <span>Ver histórico</span>
            </button>
          )}
        </div>
      </div>

      <MessageHistoryModal
        messageId={id}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </div>
  );
}
