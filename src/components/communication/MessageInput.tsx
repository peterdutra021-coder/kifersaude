import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, MapPin, Smile, X, Image as ImageIcon, File, StopCircle, Film } from 'lucide-react';
import { sendWhatsAppMessage, sendMediaMessage, sendTypingState, sendRecordingState, fileToBase64 } from '../../lib/whatsappApiService';

interface MessageInputProps {
  chatId: string;
  onMessageSent?: () => void;
  replyToMessage?: {
    id: string;
    body: string;
    from: string;
  } | null;
  onCancelReply?: () => void;
  editMessage?: {
    id: string;
    body: string;
  } | null;
  onCancelEdit?: () => void;
}

export function MessageInput({ chatId, onMessageSent, replyToMessage, onCancelReply, editMessage, onCancelEdit }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (editMessage) {
      setMessage(editMessage.body);
    }
  }, [editMessage]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [previewUrl]);

  const handleTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    sendTypingState(chatId).catch(console.error);

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 3000);
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && !selectedFile) || isSending) return;

    setIsSending(true);

    try {
      if (editMessage) {
        await sendWhatsAppMessage({
          chatId,
          contentType: 'string',
          content: message.trim(),
          editMessageId: editMessage.id,
        });

        setMessage('');
        if (onCancelEdit) onCancelEdit();
        if (onMessageSent) onMessageSent();
      } else if (selectedFile) {
        await sendMediaMessage(chatId, selectedFile, {
          caption: message.trim() || undefined,
          quotedMessageId: replyToMessage?.id,
        });

        clearFile();
        setMessage('');
        if (onCancelReply) onCancelReply();
        if (onMessageSent) onMessageSent();
      } else if (message.trim()) {
        await sendWhatsAppMessage({
          chatId,
          contentType: 'string',
          content: message.trim(),
          quotedMessageId: replyToMessage?.id,
        });

        setMessage('');
        if (onCancelReply) onCancelReply();
        if (onMessageSent) onMessageSent();
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);

      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      }

      setShowAttachMenu(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg; codecs=opus' });
        const audioFile = new File([audioBlob], 'voice.ogg', { type: 'audio/ogg' });

        setIsRecording(false);
        const recordedTime = recordingTime;
        setRecordingTime(0);

        stream.getTracks().forEach(track => track.stop());

        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }

        try {
          setIsSending(true);
          await sendMediaMessage(chatId, audioFile, {
            asVoice: true,
            quotedMessageId: replyToMessage?.id,
          });

          if (onCancelReply) onCancelReply();
          if (onMessageSent) onMessageSent();
        } catch (error) {
          console.error('Erro ao enviar áudio:', error);
          alert('Erro ao enviar mensagem de voz');
        } finally {
          setIsSending(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      sendRecordingState(chatId).catch(console.error);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Erro ao iniciar gravação:', error);
      alert('Erro ao acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não é suportada pelo seu navegador');
      return;
    }

    setShowAttachMenu(false);
    setIsSending(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await sendWhatsAppMessage({
            chatId,
            contentType: 'Location',
            content: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              description: 'Minha localização',
            },
          });

          if (onMessageSent) onMessageSent();
        } catch (error) {
          console.error('Erro ao enviar localização:', error);
          alert('Erro ao enviar localização');
        } finally {
          setIsSending(false);
        }
      },
      (error) => {
        console.error('Erro ao obter localização:', error);
        alert('Erro ao obter localização');
        setIsSending(false);
      }
    );
  };

  return (
    <div className="border-t bg-white">
      {editMessage && (
        <div className="px-4 py-2 bg-blue-50 border-b flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-blue-600">Editando mensagem</div>
            <div className="text-sm text-gray-600 truncate">{editMessage.body}</div>
          </div>
          <button
            onClick={onCancelEdit}
            className="ml-2 p-1 hover:bg-blue-100 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {replyToMessage && !editMessage && (
        <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-green-600">Respondendo a {replyToMessage.from}</div>
            <div className="text-sm text-gray-600 truncate">{replyToMessage.body}</div>
          </div>
          <button
            onClick={onCancelReply}
            className="ml-2 p-1 hover:bg-gray-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {selectedFile && (
        <div className="px-4 py-3 bg-gray-50 border-b">
          <div className="flex items-start gap-3">
            {previewUrl ? (
              selectedFile.type.startsWith('video/') ? (
                <video
                  src={previewUrl}
                  className="w-20 h-20 object-cover rounded"
                  muted
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-20 h-20 object-cover rounded"
                />
              )
            ) : (
              <div className="w-20 h-20 bg-gray-200 rounded flex items-center justify-center">
                <File className="w-8 h-8 text-gray-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{selectedFile.name}</div>
              <div className="text-xs text-gray-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </div>
              {(selectedFile.type.startsWith('image/') || selectedFile.type.startsWith('video/')) && (
                <div className="text-xs text-blue-600 mt-1">
                  Digite uma legenda abaixo (opcional)
                </div>
              )}
            </div>
            <button
              onClick={clearFile}
              className="p-1 hover:bg-gray-200 rounded"
              disabled={isSending}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="p-3 flex items-end gap-2">
        <div className="relative">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isSending}
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {showAttachMenu && (
            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border p-2 min-w-[200px]">
              <button
                onClick={() => {
                  imageInputRef.current?.click();
                  setShowAttachMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded transition-colors"
              >
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-sm">Imagem ou vídeo</span>
              </button>

              <button
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowAttachMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded transition-colors"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <File className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm">Documento</span>
              </button>

              <button
                onClick={handleSendLocation}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded transition-colors"
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm">Localização</span>
              </button>
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        <div className="flex-1 bg-white border rounded-lg flex items-end overflow-hidden">
          <button
            className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            disabled={isSending}
          >
            <Smile className="w-5 h-5" />
          </button>

          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={handleKeyPress}
            placeholder={selectedFile ? "Digite uma legenda (opcional)" : "Digite uma mensagem"}
            className="flex-1 px-2 py-2 resize-none focus:outline-none max-h-32 min-h-[40px]"
            rows={1}
            disabled={isSending || isRecording}
            style={{
              height: 'auto',
              minHeight: '40px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
            }}
          />
        </div>

        {isRecording ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-full">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-red-600">
                {formatTime(recordingTime)}
              </span>
            </div>
            <button
              onClick={stopRecording}
              className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
            >
              <StopCircle className="w-6 h-6" />
            </button>
          </div>
        ) : message.trim() || selectedFile ? (
          <button
            onClick={handleSendMessage}
            disabled={isSending}
            className="p-2 text-white bg-green-500 hover:bg-green-600 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={startRecording}
            disabled={isSending}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
