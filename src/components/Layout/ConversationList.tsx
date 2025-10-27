import { MessageCircle, Users, Bot, Search, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import type { TelegramChat, TelegramUserSearchResult } from '../../types';
import { telegramAPI } from '../../services/api';

interface ConversationListProps {
  conversations: TelegramChat[];
  currentConversation: TelegramChat | null;
  onConversationSelect: (conversation: TelegramChat) => void;
  isConnected?: boolean;
  unreadCounts: Record<number, number>; // conversationId -> count
  accountId?: number;
  onConversationCreated?: () => void;
}

export default function ConversationList({
  conversations,
  currentConversation,
  onConversationSelect,
  isConnected = false,
  unreadCounts,
  accountId,
  onConversationCreated,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TelegramUserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setShowResults(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      if (!accountId || !isConnected) {
        setIsSearching(false);
        return;
      }

      try {
        const results = await telegramAPI.searchUsers(accountId, searchQuery);
        setSearchResults(results);
        setShowResults(true);
      } catch (error) {
        console.error('Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, accountId, isConnected]);

  const handleUserClick = async (user: TelegramUserSearchResult) => {
    if (!accountId) return;

    try {
      const displayName = user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown';
      
      const conversation = await telegramAPI.createConversation(accountId, {
        telegram_peer_id: user.id,
        title: displayName,
        username: user.username,
        type: 'private',
      });

      // Clear search
      setSearchQuery('');
      setSearchResults([]);
      setShowResults(false);

      // Notify parent to refresh conversations
      if (onConversationCreated) {
        onConversationCreated();
      }

      // Select the new conversation
      onConversationSelect({
        id: conversation.id,
        title: conversation.title,
        username: user.username,
        type: 'private',
      } as TelegramChat);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };
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
        <h2 className="text-lg font-semibold text-white mb-3">Conversations</h2>
        
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            disabled={!isConnected}
            className="w-full pl-10 pr-10 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Search Results or Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {showResults && searchQuery.trim().length > 0 ? (
          // Search Results
          <div className="p-2">
            {isSearching ? (
              <div className="p-4 text-center">
                <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-2 animate-spin" />
                <p className="text-gray-400 text-sm">Searching...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-4 text-center">
                <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">No Result</p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-500 px-3 py-2 uppercase font-semibold">Search Results</p>
                {searchResults.map((user) => {
                  const displayName = user.username || `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown';
                  const subtitle = user.username ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.phone || '';
                  
                  return (
                    <div
                      key={user.id}
                      onClick={() => handleUserClick(user)}
                      className="flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors mb-1 hover:bg-gray-700 text-gray-200"
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-600">
                        <span className="text-sm font-medium">
                          {displayName.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium truncate">
                          {displayName}
                        </h3>
                        {subtitle && (
                          <p className="text-xs text-gray-400 truncate">
                            {subtitle}
                          </p>
                        )}
                      </div>

                      {/* User Icon */}
                      <div className="opacity-50">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          // Conversations List
          conversations.length === 0 ? (
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
          )
        )}
      </div>
    </div>
  );
}
