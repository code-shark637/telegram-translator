import React from 'react';
import { Plus, Smartphone, Wifi, WifiOff, Pencil, Trash2 } from 'lucide-react';
import type { TelegramAccount } from '../../types';

interface SidebarProps {
  accounts: TelegramAccount[];
  currentAccount: TelegramAccount | null;
  onAccountSelect: (account: TelegramAccount) => void;
  onAddAccount: () => void;
  onConnect: (account: TelegramAccount) => void;
  onDisconnect: (account: TelegramAccount) => void;
  onEdit: (account: TelegramAccount) => void;
  onSoftDelete: (account: TelegramAccount) => void;
}

export default function Sidebar({
  accounts,
  currentAccount,
  onAccountSelect,
  onAddAccount,
  onConnect,
  onDisconnect,
  onEdit,
  onSoftDelete,
}: SidebarProps) {
  return (
    <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <button
          onClick={onAddAccount}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Account</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
            Telegram Accounts
          </h3>
          
          {accounts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No accounts added yet</p>
              <p className="text-xs mt-1">Click "Add Account" to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    currentAccount?.id === account.id
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }`}
                  onClick={() => onAccountSelect(account)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium truncate">{account.displayName || account.accountName}</h4>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEdit(account); }}
                        className="p-1 hover:bg-gray-600 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4 text-gray-300" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onSoftDelete(account); }}
                        className="p-1 hover:bg-gray-600 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                      {account.isConnected ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDisconnect(account);
                          }}
                          className="p-1 hover:bg-gray-600 rounded"
                          title="Disconnect"
                        >
                          <Wifi className="w-4 h-4 text-green-500" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onConnect(account);
                          }}
                          className="p-1 hover:bg-gray-600 rounded"
                          title="Connect"
                        >
                          <WifiOff className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs space-y-1">
                    {account.accountName && (
                      <p className="opacity-75">{account.accountName}</p>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="opacity-75">
                        {account.sourceLanguage} → {account.targetLanguage}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          account.isConnected
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {account.isConnected ? 'Connected' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}