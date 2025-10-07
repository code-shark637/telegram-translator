import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';

// Components
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import Logout from './components/Auth/Logout';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import ChatWindow from './components/Chat/ChatWindow';
import ConversationList from './components/Layout/ConversationList';
import AddAccountModal from './components/Modals/AddAccountModal';
import EditAccountModal from './components/Modals/EditAccountModal';

// Services
import { telegramAPI, conversationsAPI, messagesAPI } from './services/api';

// Types
import type { TelegramAccount, TelegramMessage, TelegramChat } from './types';

function App() {
  // Auth state
  const { isAuthenticated, isLoading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Socket connection
  const { onMessage } = useSocket();

  // App state
  const [accounts, setAccounts] = useState<TelegramAccount[]>([]);
  const [currentAccount, setCurrentAccount] = useState<TelegramAccount | null>(null);
  const [conversations, setConversations] = useState<TelegramChat[]>([]);
  const [currentConversation, setCurrentConversation] = useState<TelegramChat | null>(null);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<TelegramAccount | null>(null);

  // Load accounts on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadAccounts();
    }
  }, [isAuthenticated]);

  // Socket event listeners
  useEffect(() => {
    const unsubscribe = onMessage((data: any) => {
      if (data?.type === 'new_message' && data.message) {
        // Only add messages for the currently selected account and conversation
        if (currentAccount && currentConversation && data.account_id === currentAccount.id) {
          if (data.message.conversation_id === currentConversation.id) {
            setMessages(prev => [...prev, data.message]);
          }
          
          // Update the conversation list to show the new message
          setConversations(prev => prev.map(conv => 
            conv.id === data.message.conversation_id 
              ? { 
                  ...conv, 
                  lastMessage: data.message,
                  lastMessageAt: data.message.created_at 
                }
              : conv
          ));
        }
      }
      if (data?.type === 'account_connected' && typeof data.account_id === 'number') {
        setAccounts(prev => prev.map(acc => acc.id === data.account_id ? { ...acc, isConnected: true } : acc));
        
        // If this is the current account, load its conversations
        if (currentAccount && currentAccount.id === data.account_id) {
          loadConversations(data.account_id);
        }
      }
      if (data?.type === 'account_disconnected' && typeof data.account_id === 'number') {
        setAccounts(prev => prev.map(acc => acc.id === data.account_id ? { ...acc, isConnected: false } : acc));
        
        // If this is the current account, clear conversations
        if (currentAccount && currentAccount.id === data.account_id) {
          setConversations([]);
          setCurrentConversation(null);
          setMessages([]);
        }
      }
    });
    return unsubscribe;
  }, [onMessage, currentAccount, currentConversation]);

  const loadAccounts = async () => {
    try {
      const accounts = await telegramAPI.getAccounts();
      setAccounts(accounts);
      
      // Auto-select first connected account
      const connectedAccount = accounts.find(acc => acc.isConnected);
      if (connectedAccount && !currentAccount) {
        setCurrentAccount(connectedAccount);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const loadConversations = async (accountId: number) => {
    try {
      const conversations = await conversationsAPI.getConversations(accountId);
      setConversations(conversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadMessages = async (conversationId: number) => {
    try {
      const messages = await messagesAPI.getMessages(conversationId);
      setMessages(messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleAccountSelect = (account: TelegramAccount) => {
    setCurrentAccount(account);
    setMessages([]); // Clear messages when switching accounts
    setCurrentConversation(null); // Clear current conversation
    setConversations([]); // Clear conversations
    
    // Only load conversations if the account is connected
    if (account.isConnected) {
      loadConversations(account.id);
    }
  };

  const handleConversationSelect = (conversation: TelegramChat) => {
    setCurrentConversation(conversation);
    setMessages([]); // Clear messages when switching conversations
    loadMessages(conversation.id); // Load messages for the selected conversation
  };

  const handleConnectAccount = async (account: TelegramAccount) => {
    try {
      await telegramAPI.connectAccount(account.id);
      await loadAccounts();
      
      // If this is the current account, load its conversations
      if (currentAccount && currentAccount.id === account.id) {
        loadConversations(account.id);
      }
    } catch (error) {
      console.error('Failed to connect account:', error);
    }
  };

  const handleDisconnectAccount = async (account: TelegramAccount) => {
    try {
      await telegramAPI.disconnectAccount(account.id);
      await loadAccounts();
      
      // If this is the current account, clear conversations
      if (currentAccount && currentAccount.id === account.id) {
        setConversations([]);
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to disconnect account:', error);
    }
  };

  const handleEditAccount = (account: TelegramAccount) => {
    setEditingAccount(account);
    setShowEditAccountModal(true);
  };

  const handleSoftDelete = async (account: TelegramAccount) => {
    try {
      await telegramAPI.updateAccount(account.id, { isActive: false });
      await loadAccounts();
    } catch (error) {
      console.error('Failed to delete account:', error);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentAccount || !currentAccount.isConnected || !currentConversation) return;

    try {
      // Send message to backend
      const response = await messagesAPI.sendMessage(
        currentConversation.id,
        text,
        true // translate the message
      );

      // The message will be added to the chat via websocket
      // No need to manually add it here since the backend sends it via websocket
      console.log('Message sent successfully:', response);
    } catch (error) {
      console.error('Failed to send message:', error);
      // You could add a toast notification here to show the error to the user
    }
  };

  // Loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Authentication screens
  if (!isAuthenticated) {
    return (
      <Router>
        <Routes>
          <Route
            path="/login"
            element={
              <LoginForm onSwitchToRegister={() => setAuthMode('register')} />
            }
          />
          <Route path="/logout" element={<Logout />} />
          <Route
            path="/register"
            element={
              <RegisterForm onSwitchToLogin={() => setAuthMode('login')} />
            }
          />
          <Route
            path="*"
            element={
              authMode === 'login' ? (
                <LoginForm onSwitchToRegister={() => setAuthMode('register')} />
              ) : (
                <RegisterForm onSwitchToLogin={() => setAuthMode('login')} />
              )
            }
          />
        </Routes>
      </Router>
    );
  }

  // Main application
  return (
    <Router>
    <div className="h-screen flex flex-col bg-gray-900">
      <Header onSettingsClick={() => {}} />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          accounts={accounts}
          currentAccount={currentAccount}
          onAccountSelect={handleAccountSelect}
          onAddAccount={() => setShowAddAccountModal(true)}
          onConnect={handleConnectAccount}
          onDisconnect={handleDisconnectAccount}
          onEdit={handleEditAccount}
          onSoftDelete={handleSoftDelete}
        />
        
        {currentAccount && (
          <ConversationList
            conversations={conversations}
            currentConversation={currentConversation}
            onConversationSelect={handleConversationSelect}
            isConnected={currentAccount.isConnected}
          />
        )}
        
        <ChatWindow
          messages={messages}
          currentConversation={currentConversation}
          currentAccount={currentAccount}
          isConnected={currentAccount?.isConnected || false}
          sourceLanguage={currentAccount?.sourceLanguage || 'auto'}
          targetLanguage={currentAccount?.targetLanguage || 'en'}
          onSendMessage={handleSendMessage}
        />
      </div>

      {/* Modals */}
      <AddAccountModal
        isOpen={showAddAccountModal}
        onClose={() => setShowAddAccountModal(false)}
        onSuccess={loadAccounts}
      />
      <EditAccountModal
        isOpen={showEditAccountModal}
        account={editingAccount}
        onClose={() => { setShowEditAccountModal(false); setEditingAccount(null); }}
        onSuccess={loadAccounts}
      />
    </div>
    </Router>
  );
}

export default App;