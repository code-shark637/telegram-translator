import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';

// Components
import LoginForm from './components/Auth/LoginForm';
import RegisterForm from './components/Auth/RegisterForm';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import ChatWindow from './components/Chat/ChatWindow';
import AddAccountModal from './components/Modals/AddAccountModal';

// Services
import { telegramAPI } from './services/api';

// Types
import type { TelegramAccount, TelegramMessage } from './types';

function App() {
  // Auth state
  const { isAuthenticated, isLoading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Socket connection
  const { socket, joinRoom, leaveRoom } = useSocket();

  // App state
  const [accounts, setAccounts] = useState<TelegramAccount[]>([]);
  const [currentAccount, setCurrentAccount] = useState<TelegramAccount | null>(null);
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Load accounts on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadAccounts();
    }
  }, [isAuthenticated]);

  // Socket event listeners
  useEffect(() => {
    if (socket) {
      socket.on('new_message', (message: TelegramMessage) => {
        setMessages(prev => [...prev, message]);
      });

      socket.on('account_connected', (data: { accountId: number }) => {
        setAccounts(prev => prev.map(acc => 
          acc.id === data.accountId ? { ...acc, isConnected: true } : acc
        ));
      });

      socket.on('account_disconnected', (data: { accountId: number }) => {
        setAccounts(prev => prev.map(acc => 
          acc.id === data.accountId ? { ...acc, isConnected: false } : acc
        ));
      });

      return () => {
        socket.off('new_message');
        socket.off('account_connected');
        socket.off('account_disconnected');
      };
    }
  }, [socket]);

  const loadAccounts = async () => {
    try {
      const response = await telegramAPI.getAccounts();
      setAccounts(response.accounts);
      
      // Auto-select first connected account
      const connectedAccount = response.accounts.find(acc => acc.isConnected);
      if (connectedAccount && !currentAccount) {
        setCurrentAccount(connectedAccount);
        joinRoom(connectedAccount.id);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const handleAccountSelect = (account: TelegramAccount) => {
    if (currentAccount) {
      leaveRoom(currentAccount.id);
    }
    setCurrentAccount(account);
    joinRoom(account.id);
    setMessages([]); // Clear messages when switching accounts
  };

  const handleConnectAccount = async (account: TelegramAccount) => {
    try {
      await telegramAPI.connectAccount(account.id);
      await loadAccounts();
    } catch (error) {
      console.error('Failed to connect account:', error);
    }
  };

  const handleDisconnectAccount = async (account: TelegramAccount) => {
    try {
      await telegramAPI.disconnectAccount(account.id);
      await loadAccounts();
    } catch (error) {
      console.error('Failed to disconnect account:', error);
    }
  };

  const handleSendMessage = (text: string) => {
    if (!currentAccount || !currentAccount.isConnected) return;

    // This would typically send via socket or API
    // For now, we'll just add it to local state
    const newMessage: TelegramMessage = {
      id: Date.now(),
      chatId: 1, // Mock chat ID
      text,
      date: new Date().toISOString(),
      isOutgoing: true,
    };

    setMessages(prev => [...prev, newMessage]);
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
    <div className="h-screen flex flex-col bg-gray-900">
      <Header onSettingsClick={() => setShowSettings(true)} />
      
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          accounts={accounts}
          currentAccount={currentAccount}
          onAccountSelect={handleAccountSelect}
          onAddAccount={() => setShowAddAccountModal(true)}
          onConnect={handleConnectAccount}
          onDisconnect={handleDisconnectAccount}
        />
        
        <ChatWindow
          messages={messages}
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
    </div>
  );
}

export default App;