import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Filter, ArrowLeft, MessageSquare } from 'lucide-react';
import { adminApi } from '../services/api';
import { Message, Conversation, ColleagueWithAccounts } from '../types';

const MessageReview = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  
  const [colleagues, setColleagues] = useState<ColleagueWithAccounts[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(
    userId ? parseInt(userId) : null
  );
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchColleagues = async () => {
      try {
        const response = await adminApi.getColleagues();
        setColleagues(response.data);
      } catch (error) {
        console.error('Failed to fetch colleagues:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchColleagues();
  }, []);

  useEffect(() => {
    if (selectedUserId || selectedAccountId) {
      fetchConversations();
    }
  }, [selectedUserId, selectedAccountId]);

  useEffect(() => {
    if (selectedConversationId) {
      fetchMessages();
    }
  }, [selectedConversationId]);

  const fetchConversations = async () => {
    try {
      const params: any = {};
      if (selectedUserId) params.user_id = selectedUserId;
      if (selectedAccountId) params.account_id = selectedAccountId;
      
      const response = await adminApi.getConversations(params);
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const params: any = { limit: 100 };
      if (selectedConversationId) params.conversation_id = selectedConversationId;
      
      const response = await adminApi.getMessages(params);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const selectedColleague = colleagues.find((c) => c.id === selectedUserId);
  const accounts = selectedColleague?.accounts || [];
  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

  // Determine if message is from the account owner (should show on right)
  const isMessageFromAccount = (message: Message) => {
    // Compare message sender_user_id with the Telegram account owner's ID
    // If they match, the message was sent by the account owner (show on right)
    if (selectedConversation?.account_telegram_user_id && message.sender_user_id) {
      return message.sender_user_id === selectedConversation.account_telegram_user_id;
    }
    // Fallback to is_outgoing if account_telegram_user_id is not available
    return message.is_outgoing;
  };

  const filteredMessages = messages.filter((msg) =>
    msg.original_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.translated_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.sender_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center mb-8">
        {userId && (
          <button
            onClick={() => navigate('/messages')}
            className="mr-4 p-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-3xl font-bold text-gray-900">Message Review</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center mb-4">
          <Filter className="w-5 h-5 text-gray-500 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Colleague
            </label>
            <select
              value={selectedUserId || ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : null;
                setSelectedUserId(value);
                setSelectedAccountId(null);
                setSelectedConversationId(null);
                setMessages([]);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Colleagues</option>
              {colleagues.map((colleague) => (
                <option key={colleague.id} value={colleague.id}>
                  {colleague.username} ({colleague.accounts.length} accounts)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Telegram Account
            </label>
            <select
              value={selectedAccountId || ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : null;
                setSelectedAccountId(value);
                setSelectedConversationId(null);
                setMessages([]);
              }}
              disabled={!selectedUserId}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">All Accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.display_name} ({account.account_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conversation
            </label>
            <select
              value={selectedConversationId || ''}
              onChange={(e) => {
                const value = e.target.value ? parseInt(e.target.value) : null;
                setSelectedConversationId(value);
              }}
              disabled={conversations.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
            >
              <option value="">Select Conversation</option>
              {conversations.map((conv) => (
                <option key={conv.id} value={conv.id}>
                  {conv.title} ({conv.type})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Search */}
      {selectedConversationId && (
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Messages */}
      {selectedConversationId ? (
        <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {filteredMessages.length > 0 ? (
              filteredMessages.map((message) => {
                const isFromAccount = isMessageFromAccount(message);
                return (
                <div
                  key={message.id}
                  className={`flex ${isFromAccount ? 'justify-end' : 'justify-start'} mb-4`}
                >
                  <div className={`max-w-[70%] ${isFromAccount ? 'ml-12' : 'mr-12'}`}>
                    {/* Sender info for incoming messages */}
                    {!isFromAccount && (
                      <div className="flex items-center space-x-2 mb-2 px-1">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-medium text-white">
                            {message.sender_name ? message.sender_name.charAt(0).toUpperCase() : '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700">
                            {message.sender_name || message.sender_username || 'Unknown'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Message bubble */}
                    <div
                      className={`px-4 py-3 rounded-2xl ${
                        isFromAccount
                          ? 'bg-blue-500 text-white rounded-br-md'
                          : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-200'
                      }`}
                    >
                      {/* Auto-reply badge */}
                      {message.type === 'auto_reply' && (
                        <div className={`flex items-center space-x-1 mb-2 pb-2 border-b ${
                          isFromAccount ? 'border-white/20' : 'border-gray-200'
                        }`}>
                          <span className="text-xs font-medium text-yellow-500">⚡ Auto-Reply</span>
                        </div>
                      )}

                      {/* Media indicator */}
                      {message.has_media && (
                        <div className={`mb-2 text-xs ${isFromAccount ? 'text-blue-100' : 'text-gray-500'}`}>
                          📎 {message.media_file_name || 'Media attachment'}
                        </div>
                      )}
                      
                      {/* Original text */}
                      {message.original_text && (
                        <div className="mb-2">
                          {message.source_language && (
                            <span className={`text-xs font-medium mr-2 ${
                              isFromAccount ? 'text-blue-200' : 'text-blue-600'
                            }`}>
                              {message.source_language.toUpperCase()}
                            </span>
                          )}
                          <p className="text-sm leading-relaxed">{message.original_text}</p>
                        </div>
                      )}
                      
                      {/* Translated text */}
                      {message.translated_text && message.translated_text !== message.original_text && (
                        <div className={`pt-2 mt-2 border-t ${
                          isFromAccount ? 'border-white/20' : 'border-gray-200'
                        }`}>
                          {message.target_language && (
                            <span className={`text-xs font-medium mr-2 ${
                              isFromAccount ? 'text-blue-200' : 'text-blue-600'
                            }`}>
                              {message.target_language.toUpperCase()}
                            </span>
                          )}
                          <p className="text-sm leading-relaxed">{message.translated_text}</p>
                        </div>
                      )}

                      {/* Timestamp */}
                      <div className="flex items-center justify-end mt-2">
                        <p className={`text-xs ${isFromAccount ? 'text-blue-100' : 'text-gray-500'}`}>
                          {new Date(message.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {isFromAccount && (
                          <div className="flex items-center ml-1">
                            <svg className="w-3 h-3 text-blue-200" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            <svg className="w-3 h-3 text-blue-200 -ml-1" fill="currentColor" viewBox="0 0 20 20">
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
            ) : (
              <div className="text-center py-12 text-gray-500">
                No messages found
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            Select a colleague and conversation to view messages
          </p>
        </div>
      )}
    </div>
  );
};

export default MessageReview;
