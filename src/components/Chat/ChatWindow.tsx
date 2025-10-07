import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Send, Languages } from 'lucide-react';
import type { TelegramMessage, TelegramChat, TelegramAccount } from '../../types';

interface ChatWindowProps {
  messages: TelegramMessage[];
  currentConversation: TelegramChat | null;
  currentAccount: TelegramAccount | null;
  isConnected: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  onSendMessage: (text: string) => Promise<void>;
}

export default function ChatWindow({
  messages,
  currentConversation,
  currentAccount,
  isConnected,
  sourceLanguage,
  targetLanguage,
  onSendMessage,
}: ChatWindowProps) {
  const [newMessage, setNewMessage] = useState('');
  const [translating, setTranslating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
          <div>
            <h2 className="text-lg font-semibold text-white">Translation Chat</h2>
            {currentAccount && (
              <p className="text-sm text-gray-400">
                {targetLanguage === 'auto' ? 'Auto-detect' : targetLanguage.toUpperCase()} → {sourceLanguage === 'auto' ? 'Auto-detect' : sourceLanguage.toUpperCase()}
              </p>
            )}
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
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Your message will be automatically translated and sent in {sourceLanguage === 'auto' ? 'detected language' : sourceLanguage.toUpperCase()}
        </p>
      </div>
    </div>
  );
}