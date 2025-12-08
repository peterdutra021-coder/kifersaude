import { useState, useEffect } from 'react';
import { Edit3, Trash2, TrendingUp, Calendar, Filter } from 'lucide-react';
import {
  getMessageEditCount,
  getMessageDeleteCount,
  getRecentHistoryActivity,
  formatActionType,
  getActionTypeColor,
  type MessageHistoryEntry,
} from '../../lib/messageHistoryService';

interface MessageHistoryPanelProps {
  chatId: string;
}

export function MessageHistoryPanel({ chatId }: MessageHistoryPanelProps) {
  const [editCount, setEditCount] = useState<number>(0);
  const [deleteCount, setDeleteCount] = useState<number>(0);
  const [recentActivity, setRecentActivity] = useState<MessageHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (chatId) {
      loadStatistics();
    }
  }, [chatId]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const [edits, deletes, activity] = await Promise.all([
        getMessageEditCount(chatId),
        getMessageDeleteCount(chatId),
        getRecentHistoryActivity(7),
      ]);

      setEditCount(edits);
      setDeleteCount(deletes);
      setRecentActivity(activity.filter((a) => a.chat_id === chatId).slice(0, 5));
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'agora mesmo';
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    if (days < 7) return `${days}d atrás`;

    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="bg-white border-t p-4">
        <div className="flex items-center justify-center py-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const hasActivity = editCount > 0 || deleteCount > 0;

  if (!hasActivity) {
    return null;
  }

  return (
    <div className="bg-white border-t">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <TrendingUp className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Atividade de Mensagens</span>
        </div>
        <div className="flex items-center space-x-3">
          {editCount > 0 && (
            <div className="flex items-center space-x-1 text-xs text-blue-600">
              <Edit3 className="h-3 w-3" />
              <span>{editCount}</span>
            </div>
          )}
          {deleteCount > 0 && (
            <div className="flex items-center space-x-1 text-xs text-red-600">
              <Trash2 className="h-3 w-3" />
              <span>{deleteCount}</span>
            </div>
          )}
          <Filter className={`h-4 w-4 text-gray-400 transition-transform ${showPanel ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {showPanel && (
        <div className="px-4 pb-4 space-y-3 border-t bg-gray-50">
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <div className="flex items-center space-x-2 mb-1">
                <Edit3 className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-900">Editadas</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{editCount}</p>
              <p className="text-xs text-blue-700 mt-1">mensagens neste chat</p>
            </div>

            <div className="bg-red-50 rounded-lg p-3 border border-red-100">
              <div className="flex items-center space-x-2 mb-1">
                <Trash2 className="h-4 w-4 text-red-600" />
                <span className="text-xs font-medium text-red-900">Deletadas</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{deleteCount}</p>
              <p className="text-xs text-red-700 mt-1">mensagens neste chat</p>
            </div>
          </div>

          {recentActivity.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Calendar className="h-4 w-4 text-gray-600" />
                <span className="text-xs font-medium text-gray-700">Atividade Recente</span>
              </div>
              <div className="space-y-2">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between text-xs border-l-2 pl-2 py-1"
                    style={{
                      borderColor:
                        activity.action_type === 'edited'
                          ? '#3b82f6'
                          : activity.action_type === 'deleted'
                          ? '#ef4444'
                          : '#8b5cf6',
                    }}
                  >
                    <span className={getActionTypeColor(activity.action_type)}>
                      {formatActionType(activity.action_type)}
                    </span>
                    <span className="text-gray-500">{formatDate(activity.changed_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
