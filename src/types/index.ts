export interface User {
  id: number;
  username: string;
  email?: string;
  createdAt: string;
}

export interface TelegramAccount {
  id: number;
  displayName?: string;
  accountName: string;
  isActive: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: string;
  lastUsed?: string;
  isConnected: boolean;
  unreadTotal?: number; // total unread across this account's conversations
}

export interface TelegramMessage {
  id: number;
  conversation_id: number;
  telegram_message_id: number;
  sender_user_id?: number;
  sender_name?: string;
  sender_username?: string;
  peer_title: string;
  type: string;
  original_text: string;
  translated_text?: string;
  source_language?: string;
  target_language?: string;
  created_at: string;
  is_outgoing: boolean;
  replyToMessageId?: number;
}

export interface TelegramChat {
  id: number;
  title?: string;
  username?: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  participantCount?: number;
  lastMessage?: TelegramMessage;
  unreadCount?: number; // unread messages in this conversation
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
  confidence?: number;
}

export interface Language {
  code: string;
  name: string;
  isSource: boolean;
  isTarget: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AppState {
  currentAccount: TelegramAccount | null;
  accounts: TelegramAccount[];
  currentChat: TelegramChat | null;
  chats: TelegramChat[];
  messages: TelegramMessage[];
  isConnected: boolean;
}