import { MessageCircle, Users, Bot } from 'lucide-react';
import type { TelegramChat } from '../../types';

interface ConversationListProps {
  conversations: TelegramChat[];
  currentConversation: TelegramChat | null;
  onConversationSelect: (conversation: TelegramChat) => void;
  isConnected?: boolean;
  unreadCounts: Record<number, number>; // conversationId -> count
}

export default function ConversationList({
  conversations,
  currentConversation,
  onConversationSelect,
  isConnected = false,
  unreadCounts,
}: ConversationListProps) {
  const getConversationIcon = (type: string) => {
    switch (type) {
      case 'private':
        return <MessageCircle className="w-5 h-5" />;
      case 'group':
      case 'supergroup':
        return <Users className="w-5 h-5" />;
      case 'channel':
        return <Bot className="w-5 h-5" />;
      default:
        return <MessageCircle className="w-5 h-5" />;
    }
  };

  const getConversationAvatar = (conversation: TelegramChat) => {
    if (conversation.title) {
      return conversation.title.charAt(0).toUpperCase();
    }
    if (conversation.username) {
      return conversation.username.charAt(0).toUpperCase();
    }
    return '?';
  };

  return (
    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-lg font-semibold text-white">Conversations</h2>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center">
            <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">
              {isConnected ? 'No conversations yet' : 'Connect account to see conversations'}
            </p>
          </div>
        ) : (
          <div className="p-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onConversationSelect(conversation)}
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                  currentConversation?.id === conversation.id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-700 text-gray-200'
                }`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  currentConversation?.id === conversation.id
                    ? 'bg-blue-500'
                    : 'bg-gray-600'
                }`}>
                  <span className="text-sm font-medium">
                    {getConversationAvatar(conversation)}
                  </span>
                </div>

                {/* Conversation Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium truncate">
                      {conversation.title || conversation.username || 'Unknown'}
                    </h3>
                    {conversation.lastMessage && (
                      <span className="text-xs opacity-70">
                        {new Date(conversation.lastMessage.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mt-1">
                    {conversation.lastMessage?.original_text && (
                      <p className="text-xs opacity-70 truncate">
                        {conversation.lastMessage.original_text}
                      </p>
                    )}
                    {unreadCounts[conversation.id] > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[10px]">
                        {unreadCounts[conversation.id]}
                      </span>
                    )}
                    {conversation.participantCount && conversation.participantCount > 1 && (
                      <span className="text-xs opacity-50">
                        {conversation.participantCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* Type Icon */}
                <div className="opacity-50">
                  {getConversationIcon(conversation.type)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
