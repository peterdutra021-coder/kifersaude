import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, MessageCircle, Phone, Video, MoreVertical, ArrowLeft } from 'lucide-react';
import { MessageInput } from './MessageInput';
import { MessageBubble } from './MessageBubble';

type WhatsAppChat = {
  id: string;
  name: string | null;
  is_group: boolean;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  last_message?: string;
  unread_count?: number;
};

type WhatsAppMessage = {
  id: string;
  chat_id: string;
  from_number: string | null;
  to_number: string | null;
  type: string | null;
  body: string | null;
  has_media: boolean;
  timestamp: string | null;
  direction: 'inbound' | 'outbound' | null;
  ack_status: number | null;
  created_at: string;
};

export default function WhatsAppTab() {
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isMobileView, setIsMobileView] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<{
    id: string;
    body: string;
    from: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  useEffect(() => {
    loadChats();

    const chatsSubscription = supabase
      .channel('whatsapp_chats_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_chats' }, () => {
        loadChats();
      })
      .subscribe();

    const messagesGlobalSubscription = supabase
      .channel('whatsapp_messages_global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_messages' }, () => {
        loadChats();
      })
      .subscribe();

    return () => {
      chatsSubscription.unsubscribe();
      messagesGlobalSubscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);

      const messagesSubscription = supabase
        .channel(`messages_${selectedChat.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'whatsapp_messages', filter: `chat_id=eq.${selectedChat.id}` },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as WhatsAppMessage]);
            scrollToBottom();
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'whatsapp_messages', filter: `chat_id=eq.${selectedChat.id}` },
          (payload) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === payload.new.id ? (payload.new as WhatsAppMessage) : msg
              )
            );
          }
        )
        .subscribe();

      return () => {
        messagesSubscription.unsubscribe();
      };
    }
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChats = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_chats')
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const chatsWithLastMessage = await Promise.all(
        (data || []).map(async (chat) => {
          const { data: lastMsg } = await supabase
            .from('whatsapp_messages')
            .select('body')
            .eq('chat_id', chat.id)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...chat,
            last_message: lastMsg?.body || null,
          };
        })
      );

      setChats(chatsWithLastMessage);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleReply = (messageId: string, body: string, from: string) => {
    setReplyToMessage({ id: messageId, body, from });
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  const handleMessageSent = () => {
    loadMessages(selectedChat!.id);
    scrollToBottom();
  };

  const filteredChats = chats.filter(
    (chat) =>
      chat.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chat.id.includes(searchQuery)
  );

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Ontem';
    } else if (diffInHours < 168) {
      return date.toLocaleDateString('pt-BR', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    const words = name.split(' ');
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const showChatList = !isMobileView || !selectedChat;
  const showMessageArea = !isMobileView || selectedChat;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50">
      {showChatList && (
        <div className={`${isMobileView ? 'w-full' : 'w-96'} bg-white border-r border-slate-200 flex flex-col`}>
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar conversas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <MessageCircle className="w-16 h-16 mb-4 text-slate-300" />
                <p className="text-lg font-medium">Nenhuma conversa</p>
                <p className="text-sm">As mensagens do WhatsApp aparecerão aqui</p>
              </div>
            ) : (
              filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full p-4 flex items-start gap-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    selectedChat?.id === chat.id ? 'bg-teal-50' : ''
                  }`}
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold">
                    {getInitials(chat.name)}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-slate-900 truncate">
                        {chat.name || chat.id}
                      </h3>
                      <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                        {formatTime(chat.last_message_at)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 truncate">
                      {chat.last_message || 'Sem mensagens'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {showMessageArea && (
        <div className={`${isMobileView ? 'w-full' : 'flex-1'} flex flex-col bg-slate-100`}>
          {selectedChat ? (
            <>
              <div className="bg-white border-b border-slate-200 p-4 flex items-center gap-3">
                {isMobileView && (
                  <button
                    onClick={() => setSelectedChat(null)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                  </button>
                )}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-semibold">
                  {getInitials(selectedChat.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-slate-900 truncate">
                    {selectedChat.name || selectedChat.id}
                  </h2>
                  <p className="text-xs text-slate-500">Online</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <Phone className="w-5 h-5 text-slate-600" />
                  </button>
                  <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <Video className="w-5 h-5 text-slate-600" />
                  </button>
                  <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <MoreVertical className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-500">
                    <p>Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      id={message.id}
                      body={message.body}
                      type={message.type}
                      direction={message.direction || 'inbound'}
                      timestamp={message.timestamp}
                      ackStatus={message.ack_status}
                      hasMedia={message.has_media}
                      fromName={selectedChat?.name || undefined}
                      onReply={handleReply}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <MessageInput
                chatId={selectedChat.id}
                onMessageSent={handleMessageSent}
                replyToMessage={replyToMessage}
                onCancelReply={handleCancelReply}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
              <MessageCircle className="w-24 h-24 mb-4 text-slate-300" />
              <h2 className="text-2xl font-semibold mb-2">WhatsApp Web</h2>
              <p className="text-center max-w-md">
                Selecione uma conversa para começar a enviar e receber mensagens
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
