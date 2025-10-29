import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Languages, Clock, FileText, Copy, User, Paperclip, X, Image as ImageIcon, Video, Download, Play } from 'lucide-react';
import { templatesAPI, scheduledMessagesAPI } from '../../services/api';
import type { TelegramMessage, TelegramChat, TelegramAccount, MessageTemplate, ScheduledMessage } from '../../types';
import ScheduleMessageModal from '../Modals/ScheduleMessageModal';
import MessageTemplatesModal from '../Modals/MessageTemplatesModal';
import ContactInfoModal from '../Modals/ContactInfoModal';

// Photo Message Component - displays images inline like Telegram
const PhotoMessage: React.FC<{
  message: TelegramMessage;
  loadedImages: Record<number, string>;
  loadImage: (message: TelegramMessage) => Promise<string | null>;
  onDownload: (message: TelegramMessage) => void;
}> = ({ message, loadedImages, loadImage, onDownload }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(loadedImages[message.id] || null);
  const [loading, setLoading] = useState(!loadedImages[message.id]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!loadedImages[message.id] && !error) {
      setLoading(true);
      loadImage(message).then(url => {
        if (url) {
          setImageUrl(url);
        } else {
          setError(true);
        }
        setLoading(false);
      });
    }
  }, [message, loadedImages, loadImage, error]);

  if (loading) {
    return (
      <div className="mb-2">
        <div className="bg-gray-800/30 rounded-lg p-8 flex items-center justify-center min-w-[200px] min-h-[150px]">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            <p className="text-xs text-gray-400">Loading image...</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if media was deleted
  if (imageUrl === 'DELETED') {
    return (
      <div className="mb-2">
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-center space-x-3">
          <ImageIcon className="w-8 h-8 text-red-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-300">📷 Photo</p>
            <p className="text-xs text-red-400">Media has been deleted</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className="mb-2">
        <div 
          className="bg-gray-800/50 rounded-lg p-4 flex items-center space-x-3 cursor-pointer hover:bg-gray-800/70 transition-colors"
          onClick={() => onDownload(message)}
        >
          <ImageIcon className="w-8 h-8 text-blue-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">📷 Photo</p>
            <p className="text-xs text-gray-400">Click to download</p>
          </div>
          <Download className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <div 
        className="relative rounded-lg overflow-hidden cursor-pointer group max-w-md"
        onClick={() => onDownload(message)}
        title="Click to download"
      >
        <img
          src={imageUrl}
          alt={message.media_file_name || 'Photo'}
          className="w-full h-auto max-h-[400px] object-contain bg-gray-900/50"
          style={{ display: 'block' }}
        />
        {/* Download overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center space-y-2">
            <Download className="w-10 h-10 text-white drop-shadow-lg" />
            <span className="text-white text-sm font-medium drop-shadow-lg">Download</span>
          </div>
        </div>
      </div>
      {message.media_file_name && (
        <p className="text-xs text-gray-400 mt-1 px-1">{message.media_file_name}</p>
      )}
    </div>
  );
};

// Video Message Component - displays videos inline like Telegram
const VideoMessage: React.FC<{
  message: TelegramMessage;
  loadedImages: Record<number, string>;
  loadImage: (message: TelegramMessage) => Promise<string | null>;
  onDownload: (message: TelegramMessage) => void;
}> = ({ message, loadedImages, loadImage, onDownload }) => {
  const [videoUrl, setVideoUrl] = useState<string | null>(loadedImages[message.id] || null);
  const [loading, setLoading] = useState(!loadedImages[message.id]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!loadedImages[message.id] && !error) {
      setLoading(true);
      loadImage(message).then(url => {
        if (url) {
          setVideoUrl(url);
        } else {
          setError(true);
        }
        setLoading(false);
      });
    }
  }, [message, loadedImages, loadImage, error]);

  if (loading) {
    return (
      <div className="mb-2">
        <div className="bg-gray-800/30 rounded-lg p-8 flex items-center justify-center min-w-[200px] min-h-[150px]">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
            <p className="text-xs text-gray-400">Loading video...</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if media was deleted
  if (videoUrl === 'DELETED') {
    return (
      <div className="mb-2">
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-center space-x-3">
          <Video className="w-8 h-8 text-red-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-300">🎥 Video</p>
            <p className="text-xs text-red-400">Media has been deleted</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !videoUrl) {
    return (
      <div className="mb-2">
        <div 
          className="bg-gray-800/50 rounded-lg p-4 flex items-center space-x-3 cursor-pointer hover:bg-gray-800/70 transition-colors"
          onClick={() => onDownload(message)}
        >
          <Video className="w-8 h-8 text-purple-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">🎥 Video</p>
            <p className="text-xs text-gray-400">Click to download</p>
          </div>
          <Download className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2">
      <div 
        className="relative rounded-lg overflow-hidden max-w-md bg-gray-900/50"
      >
        <video
          src={videoUrl}
          controls
          className="w-full h-auto max-h-[400px] object-contain"
          style={{ display: 'block' }}
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
        {/* Download button overlay */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload(message);
          }}
          className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-black/80 rounded-lg transition-colors"
          title="Download video"
        >
          <Download className="w-5 h-5 text-white" />
        </button>
      </div>
      {message.media_file_name && (
        <p className="text-xs text-gray-400 mt-1 px-1">{message.media_file_name}</p>
      )}
    </div>
  );
};

interface ChatWindowProps {
  messages: TelegramMessage[];
  currentConversation: TelegramChat | null;
  currentAccount: TelegramAccount | null;
  isConnected: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  onSendMessage: (text: string) => Promise<void>;
  conversationId?: number;
}

export default function ChatWindow({
  messages,
  currentConversation,
  currentAccount,
  isConnected,
  sourceLanguage,
  targetLanguage,
  onSendMessage,
  conversationId,
}: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState('');
  const [translating, setTranslating] = useState(false);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactSaveAlert, setContactSaveAlert] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<number, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (conversationId) {
      loadScheduledMessages();
    } else {
      // Clear scheduled messages when no conversation is selected
      setScheduledMessages([]);
    }
  }, [conversationId]);

  // Reload scheduled messages when messages change (to detect system messages about sent/cancelled)
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      // Check if any recent message is a system message about scheduled messages
      const recentMessages = messages.slice(-5); // Check last 5 messages
      const hasScheduledSystemMessage = recentMessages.some(msg => 
        msg.type === 'system' && 
        msg.original_text && (
          msg.original_text.includes('Scheduled message sent') ||
          msg.original_text.includes('Scheduled message cancelled') ||
          msg.original_text.includes('Scheduled message manually cancelled') ||
          msg.original_text.includes('Scheduled message set')
        )
      );
      
      if (hasScheduledSystemMessage) {
        // Add a small delay to ensure database is updated before reloading
        const timer = setTimeout(() => {
          loadScheduledMessages();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [messages, conversationId]);

  const loadTemplates = async () => {
    try {
      const data = await templatesAPI.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const loadScheduledMessages = async () => {
    if (!conversationId) return;
    try {
      const data = await scheduledMessagesAPI.getScheduledMessagesByConversation(conversationId);
      setScheduledMessages(data);
    } catch (err) {
      console.error('Failed to load scheduled messages:', err);
    }
  };

  const handleTemplateSelect = (template: MessageTemplate) => {
    setNewMessage(template.content);
    setShowTemplates(false);
  };

  const handleCancelScheduledMessage = async (messageId: number) => {
    if (!confirm('Cancel this scheduled message?')) return;
    try {
      await scheduledMessagesAPI.cancelScheduledMessage(messageId);
      // Remove from local state immediately for instant feedback
      setScheduledMessages(scheduledMessages.filter(m => m.id !== messageId));
      // The system message will be added via WebSocket and trigger a reload
    } catch (err) {
      console.error('Failed to cancel scheduled message:', err);
    }
  };

  const handleContactSaved = () => {
    setContactSaveAlert(true);
    setTimeout(() => setContactSaveAlert(false), 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type (images and videos)
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    // if (!validTypes.includes(file.type)) {
    //   alert('Please select an image or video file');
    //   return;
    // }

    // Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert('File size must be less than 50MB');
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendFile = async () => {
    if (!selectedFile || !currentConversation || !isConnected) return;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('conversation_id', currentConversation.id.toString());
      formData.append('caption', newMessage);

      const response = await fetch('http://localhost:8000/api/messages/send-media', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${document.cookie.split('auth_token=')[1]?.split(';')[0]}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to send media');
      }

      // Clear file and message
      handleRemoveFile();
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send file:', error);
      alert('Failed to send file. Please try again.');
    } finally {
      setUploadingFile(false);
    }
  };

  const loadImage = async (message: TelegramMessage) => {
    // Return cached image if already loaded
    if (loadedImages[message.id]) {
      return loadedImages[message.id];
    }

    try {
      const token = document.cookie.split('auth_token=')[1]?.split(';')[0];
      const url = `http://localhost:8000/api/messages/download-media/${message.conversation_id}/${message.id}?telegram_message_id=${message.telegram_message_id}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Check if media was deleted (410 Gone)
      if (response.status === 410) {
        // Mark as deleted
        setLoadedImages(prev => ({ ...prev, [message.id]: 'DELETED' }));
        return 'DELETED';
      }

      if (!response.ok) {
        throw new Error('Failed to load media');
      }

      const blob = await response.blob();
      const imageUrl = window.URL.createObjectURL(blob);
      
      // Cache the loaded image
      setLoadedImages(prev => ({ ...prev, [message.id]: imageUrl }));
      
      return imageUrl;
    } catch (error) {
      console.error('Failed to load media:', error);
      return null;
    }
  };

  const handleDownloadMedia = async (message: TelegramMessage) => {
    try {
      const token = document.cookie.split('auth_token=')[1]?.split(';')[0];
      const url = `http://localhost:8000/api/messages/download-media/${message.conversation_id}/${message.id}?telegram_message_id=${message.telegram_message_id}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download media');
      }

      // Get filename from Content-Disposition header or use stored filename
      const contentDisposition = response.headers.get('content-disposition');
      let filename = message.media_file_name || `media_${message.telegram_message_id}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download media:', error);
      alert('Failed to download media. Please try again.');
    }
  };

  // Sort messages by timestamp
  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages]);

  // Determine if message should be shown on the right (outgoing style)
  const isMessageOutgoing = (message: TelegramMessage) => {
    // If message is already marked as outgoing, use that
    if (message.is_outgoing) return true;
    
    // If we have current account info, check if sender matches current account
    if (currentAccount && message.sender_username) {
      return message.sender_username === currentAccount.accountName;
    }
    
    // Fallback to original is_outgoing
    return message.is_outgoing;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected || !currentConversation || translating) return;

    setTranslating(true);
    try {
      // Send the message directly - translation is handled by the backend
      await onSendMessage(newMessage);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      // You could add a toast notification here to show the error to the user
    } finally {
      setTranslating(false);
    }
  };


  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Contact Save Alert */}
      {contactSaveAlert && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Contact information saved successfully!</span>
          </div>
        </div>
      )}

      {/* Chat header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Translation Chat</h2>
                {currentAccount && (
                  <p className="text-sm text-gray-400">
                    {targetLanguage === 'auto' ? 'Auto-detect' : targetLanguage.toUpperCase()} → {sourceLanguage === 'auto' ? 'Auto-detect' : sourceLanguage.toUpperCase()}
                  </p>
                )}
              </div>
              {/* Scheduled Messages Badge */}
              {scheduledMessages.length > 0 && (
                <div className="flex items-center space-x-2">
                  {scheduledMessages.map((sm) => {
                    const scheduledDate = new Date(sm.scheduled_at);
                    const formattedDate = scheduledDate.toLocaleString('en-US', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                      timeZoneName: 'short'
                    });
                    return (
                      <div
                        key={sm.id}
                        className="flex items-center space-x-2 px-3 py-2 bg-blue-500/20 border border-blue-500/40 rounded-lg"
                      >
                        <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <div className="flex flex-col">
                          <span className="text-xs text-blue-300 font-medium">
                            {formattedDate}
                          </span>
                          <span className="text-xs text-gray-400 truncate max-w-xs">
                            {sm.message_text}
                          </span>
                        </div>
                        <button
                          onClick={() => handleCancelScheduledMessage(sm.id)}
                          className="text-red-400 hover:text-red-300 text-xs ml-2 flex-shrink-0"
                          title="Cancel scheduled message"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {/* Contact Info Button */}
          {currentConversation && (
            <button
              onClick={() => setShowContactModal(true)}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-2 text-sm"
              title="Contact CRM Info"
            >
              <User className="w-4 h-4" />
              <span>CRM</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <Languages className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">
              {!currentConversation ? 'Select a conversation' : 'No messages yet'}
            </h3>
            <p className="text-gray-500">
              {!currentConversation 
                ? 'Choose a conversation from the list to start viewing messages'
                : isConnected
                  ? 'Start a conversation to see real-time translations'
                  : 'Connect to a Telegram account to begin'
              }
            </p>
          </div>
        ) : (
          sortedMessages.map((message) => {
            // System messages (scheduled message cancellations)
            if (message.type === 'system') {
              return (
                <div key={message.id} className="flex justify-center mb-4">
                  <div className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg max-w-2xl">
                    <p className="text-xs text-yellow-300 text-center">
                      {message.original_text}
                    </p>
                    <p className="text-xs text-gray-500 text-center mt-1">
                      {new Date(message.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
            }

            const isOutgoing = isMessageOutgoing(message);
            
            return (
            <div
              key={message.id}
              className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-4`}
            >
              <div className={`max-w-xs lg:max-w-md ${isOutgoing ? 'ml-12' : 'mr-12'}`}>
                {/* Sender info for incoming messages */}
                {!isOutgoing && (
                  <div className="flex items-center space-x-2 mb-2 px-1">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {message.sender_name ? message.sender_name.charAt(0).toUpperCase() : '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-pink-400">
                        {message.sender_name || message.sender_username || 'Unknown'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`px-4 py-3 rounded-2xl ${
                    isOutgoing
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-gray-700 text-gray-200 rounded-bl-md'
                  }`}
                >
                  {/* Photo - Display as inline image like Telegram */}
                  {message.type === 'photo' && (
                    <PhotoMessage 
                      message={message}
                      loadedImages={loadedImages}
                      loadImage={loadImage}
                      onDownload={handleDownloadMedia}
                    />
                  )}

                  {/* Video - Display as inline video player like Telegram */}
                  {message.type === 'video' && (
                    <VideoMessage 
                      message={message}
                      loadedImages={loadedImages}
                      loadImage={loadImage}
                      onDownload={handleDownloadMedia}
                    />
                  )}

                  {/* Document - keep as icon */}
                  {message.type === 'document' && (
                    <div className="mb-3">
                      <div className="bg-gray-800/50 rounded-lg p-3 flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <FileText className="w-8 h-8 text-green-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {message.media_file_name || '📄 Document'}
                          </p>
                          <p className="text-xs text-gray-400">Click to download</p>
                        </div>
                        <button
                          onClick={() => handleDownloadMedia(message)}
                          className="flex-shrink-0 p-2 hover:bg-gray-700 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Caption/Text */}
                  {message.original_text && (
                    <div className="mb-2">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-medium text-blue-400">
                          {message.source_language && `${message.source_language.toUpperCase()}`}
                        </span>
                        <span className="text-sm leading-relaxed">{message.original_text}</span>
                      </div>
                    </div>
                  )}

                  {/* Translated caption/message */}
                  {message.translated_text && (
                    <div className="border-t border-gray-500 pt-2 mt-2">
                      <p className="text-sm leading-relaxed">{message.translated_text}</p>
                    </div>
                  )}

                  {/* Timestamp and read receipt */}
                  <div className="flex items-center justify-end mt-2 space-x-1">
                    <p className="text-xs opacity-70">
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {isOutgoing && (
                      <div className="flex items-center">
                        <svg className="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <svg className="w-3 h-3 text-blue-400 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div className="bg-gray-800 border-t border-gray-700 p-6">
        {/* Template Selector */}
        {showTemplates && templates.length > 0 && (
          <div className="mb-4 p-3 bg-gray-700 rounded-lg border border-gray-600 max-h-48 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">Select Template</span>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-gray-400 hover:text-white text-xs"
              >
                Close
              </button>
            </div>
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className="w-full text-left p-2 bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                >
                  <div className="text-sm font-medium text-white">{template.name}</div>
                  <div className="text-xs text-gray-400 truncate">{template.content}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2 mb-3">
          <button
            type="button"
            onClick={() => setShowTemplates(!showTemplates)}
            disabled={!isConnected || !currentConversation}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2 text-sm"
          >
            <Copy className="w-4 h-4" />
            <span>Templates</span>
          </button>
          <button
            type="button"
            onClick={() => setShowTemplatesModal(true)}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center space-x-2 text-sm"
          >
            <FileText className="w-4 h-4" />
            <span>Manage</span>
          </button>
        </div>

        {/* File Preview */}
        {selectedFile && (
          <div className="mb-4 p-4 bg-gray-700 rounded-lg border border-gray-600">
            <div className="flex items-start space-x-3">
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="w-20 h-20 object-cover rounded" />
              ) : (
                <div className="w-20 h-20 bg-gray-600 rounded flex items-center justify-center">
                  <Video className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-400">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={handleRemoveFile}
                className="text-gray-400 hover:text-white"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex space-x-4">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                !currentConversation
                  ? 'Select a conversation to start messaging'
                  : isConnected
                    ? `Type in ${targetLanguage === 'auto' ? 'any language' : targetLanguage.toUpperCase()}... (will be translated to ${sourceLanguage === 'auto' ? 'detected language' : sourceLanguage.toUpperCase()})`
                    : 'Connect to an account to start messaging'
              }
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors pr-12"
              disabled={!isConnected || !currentConversation || translating}
            />
            {translating && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Languages className="w-5 h-5 text-blue-400 animate-pulse" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isConnected || !currentConversation || uploadingFile}
            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          {selectedFile ? (
            <button
              type="button"
              onClick={handleSendFile}
              disabled={uploadingFile || !isConnected || !currentConversation}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              {uploadingFile ? (
                <Languages className="w-4 h-4 animate-pulse" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{uploadingFile ? 'Sending...' : 'Send File'}</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!newMessage.trim() || !isConnected || !currentConversation || translating}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowScheduleModal(true)}
            disabled={!newMessage.trim() || !isConnected || !currentConversation}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
            title="Schedule Message"
          >
            <Clock className="w-4 h-4" />
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Your message will be automatically translated and sent in {sourceLanguage === 'auto' ? 'detected language' : sourceLanguage.toUpperCase()}
        </p>
      </div>

      {/* Modals */}
      <ScheduleMessageModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        conversationId={conversationId || null}
        messageText={newMessage}
        onScheduled={loadScheduledMessages}
      />
      <MessageTemplatesModal
        isOpen={showTemplatesModal}
        onClose={() => {
          setShowTemplatesModal(false);
          loadTemplates();
        }}
      />
      <ContactInfoModal
        isOpen={showContactModal}
        onClose={() => setShowContactModal(false)}
        conversationId={conversationId || null}
        onSaved={handleContactSaved}
      />
    </div>
  );
}