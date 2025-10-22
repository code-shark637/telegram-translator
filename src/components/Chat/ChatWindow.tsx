import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Languages, Clock, FileText, Copy } from 'lucide-react';
import { templatesAPI, scheduledMessagesAPI } from '../../services/api';
import type { TelegramMessage, TelegramChat, TelegramAccount, MessageTemplate, ScheduledMessage } from '../../types';
import ScheduleMessageModal from '../Modals/ScheduleMessageModal';
import MessageTemplatesModal from '../Modals/MessageTemplatesModal';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
                  {/* Original message */}
                  <div className="mb-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-xs font-medium text-blue-400">
                        {message.source_language && `${message.source_language.toUpperCase()}`}
                      </span>
                      <span className="text-sm leading-relaxed">{message.original_text}</span>
                    </div>
                  </div>

                  {/* Translated message */}
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

        <form onSubmit={handleSendMessage} className="flex space-x-4">
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
            type="submit"
            disabled={!newMessage.trim() || !isConnected || !currentConversation || translating}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <Send className="w-4 h-4" />
          </button>
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
    </div>
  );
}