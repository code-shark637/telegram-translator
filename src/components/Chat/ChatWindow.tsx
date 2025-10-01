import React, { useState, useRef, useEffect } from 'react';
import { Send, Languages, Volume2, Copy } from 'lucide-react';
import type { TelegramMessage } from '../../types';
import { translationAPI } from '../../services/api';

interface ChatWindowProps {
  messages: TelegramMessage[];
  isConnected: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  onSendMessage: (text: string) => void;
}

export default function ChatWindow({
  messages,
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !isConnected || translating) return;

    setTranslating(true);
    try {
      // Translate the message before sending
      const result = await translationAPI.translate(
        newMessage,
        targetLanguage,
        sourceLanguage === 'auto' ? undefined : sourceLanguage
      );
      
      // Send the translated text
      onSendMessage(result.translatedText);
      setNewMessage('');
    } catch (error) {
      console.error('Translation failed:', error);
      // If translation fails, send the original message
      onSendMessage(newMessage);
      setNewMessage('');
    } finally {
      setTranslating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Chat header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Translation Chat</h2>
            <p className="text-sm text-gray-400">
              {sourceLanguage === 'auto' ? 'Auto-detect' : sourceLanguage.toUpperCase()} → {targetLanguage.toUpperCase()}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isConnected
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          }`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <Languages className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">No messages yet</h3>
            <p className="text-gray-500">
              {isConnected
                ? 'Start a conversation to see real-time translations'
                : 'Connect to a Telegram account to begin'
              }
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isOutgoing ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                  message.isOutgoing
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-200'
                }`}
              >
                {/* Original message */}
                <div className="mb-2">
                  <p className="text-sm">{message.text}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs opacity-70">
                      {message.detectedLanguage && `${message.detectedLanguage.toUpperCase()}`}
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => copyToClipboard(message.text)}
                        className="p-1 hover:bg-black/20 rounded transition-colors"
                        title="Copy original"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Translated message */}
                {message.translatedText && (
                  <div className="border-t border-white/20 pt-2 mt-2">
                    <p className="text-sm italic opacity-90">{message.translatedText}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs opacity-70">
                        Translation
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => copyToClipboard(message.translatedText!)}
                          className="p-1 hover:bg-black/20 rounded transition-colors"
                          title="Copy translation"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs opacity-50 mt-2">
                  {new Date(message.date).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
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
                isConnected
                  ? `Type in ${sourceLanguage === 'auto' ? 'any language' : sourceLanguage.toUpperCase()}... (will be translated to ${targetLanguage.toUpperCase()})`
                  : 'Connect to an account to start messaging'
              }
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors pr-12"
              disabled={!isConnected || translating}
            />
            {translating && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Languages className="w-5 h-5 text-blue-400 animate-pulse" />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || !isConnected || translating}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Your message will be automatically translated and sent in {targetLanguage.toUpperCase()}
        </p>
      </div>
    </div>
  );
}