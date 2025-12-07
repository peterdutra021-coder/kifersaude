import { Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MessageBubbleProps {
  id: string;
  body: string | null;
  type: string | null;
  direction: 'inbound' | 'outbound';
  timestamp: string | null;
  ackStatus: number | null;
  hasMedia: boolean;
  fromName?: string;
  onReply?: (messageId: string, body: string, from: string) => void;
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
  onReply,
}: MessageBubbleProps) {
  const isOutbound = direction === 'outbound';

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

          <div className="flex items-center justify-end gap-1 mt-1">
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

        {onReply && (
          <button
            onClick={() => onReply(id, body || '', fromName || 'Contato')}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 hover:text-gray-700 mt-1 px-2"
          >
            Responder
          </button>
        )}
      </div>
    </div>
  );
}
