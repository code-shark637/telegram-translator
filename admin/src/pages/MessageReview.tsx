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
                  {account.display_name}
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {filteredMessages.length > 0 ? (
              filteredMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.is_outgoing ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-4 ${
                      message.is_outgoing
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <span className="text-xs font-semibold">
                        {message.sender_name}
                      </span>
                      <span className="text-xs ml-2 opacity-75">
                        {new Date(message.created_at).toLocaleString()}
                      </span>
                    </div>
                    
                    {message.original_text && (
                      <div className="mb-2">
                        <p className="text-sm">{message.original_text}</p>
                      </div>
                    )}
                    
                    {message.translated_text && message.translated_text !== message.original_text && (
                      <div className="pt-2 border-t border-opacity-20 border-current">
                        <p className="text-xs opacity-75 mb-1">Translation:</p>
                        <p className="text-sm">{message.translated_text}</p>
                      </div>
                    )}

                    {message.has_media && (
                      <div className="mt-2 text-xs opacity-75">
                        📎 {message.media_file_name || 'Media attachment'}
                      </div>
                    )}
                  </div>
                </div>
              ))
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
