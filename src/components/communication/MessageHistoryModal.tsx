import { useState, useEffect } from 'react';
import { X, Clock, Edit3, Trash2, RotateCcw, AlertCircle } from 'lucide-react';
import {
  getMessageHistory,
  formatActionType,
  getActionTypeColor,
  type MessageHistoryEntry,
} from '../../lib/messageHistoryService';

interface MessageHistoryModalProps {
  messageId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MessageHistoryModal({ messageId, isOpen, onClose }: MessageHistoryModalProps) {
  const [history, setHistory] = useState<MessageHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && messageId) {
      loadHistory();
    }
  }, [isOpen, messageId]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMessageHistory(messageId);
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'edited':
        return <Edit3 className="h-5 w-5" />;
      case 'deleted':
        return <Trash2 className="h-5 w-5" />;
      case 'restored':
        return <RotateCcw className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const renderBodyDiff = (entry: MessageHistoryEntry) => {
    if (entry.action_type === 'deleted') {
      return (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">Conteúdo deletado:</div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-gray-700 line-through">{entry.old_body || '[Sem conteúdo]'}</p>
          </div>
        </div>
      );
    }

    if (entry.action_type === 'edited') {
      return (
        <div className="space-y-2">
          {entry.old_body && (
            <div>
              <div className="text-sm text-gray-600 mb-1">Antes:</div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">{entry.old_body}</p>
              </div>
            </div>
          )}
          {entry.new_body && (
            <div>
              <div className="text-sm text-gray-600 mb-1">Depois:</div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">{entry.new_body}</p>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (entry.action_type === 'restored') {
      return (
        <div className="space-y-2">
          <div className="text-sm text-gray-600">Mensagem restaurada:</div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <p className="text-sm text-gray-700">{entry.new_body || '[Sem conteúdo]'}</p>
          </div>
        </div>
      );
    }

    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Clock className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Histórico da Mensagem</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Erro ao carregar histórico</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Nenhum histórico encontrado para esta mensagem</p>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="space-y-4">
              {history.map((entry, index) => (
                <div
                  key={entry.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`${getActionTypeColor(entry.action_type)}`}>
                      {getActionIcon(entry.action_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${getActionTypeColor(entry.action_type)}`}>
                          {formatActionType(entry.action_type)}
                        </span>
                        <span className="text-sm text-gray-500">
                          {formatDate(entry.changed_at)}
                        </span>
                      </div>
                      {entry.changed_by && (
                        <p className="text-sm text-gray-600 mt-1">Por: {entry.changed_by}</p>
                      )}
                    </div>
                  </div>

                  {renderBodyDiff(entry)}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
