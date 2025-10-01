export interface User {
  id: number;
  username: string;
  email?: string;
  createdAt: string;
}

export interface TelegramAccount {
  id: number;
  sessionName: string;
  phoneNumber?: string;
  accountName: string;
  isActive: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  createdAt: string;
  lastUsed?: string;
  isConnected: boolean;
}

export interface TelegramMessage {
  id: number;
  chatId: number;
  senderId?: number;
  senderUsername?: string;
  text: string;
  translatedText?: string;
  detectedLanguage?: string;
  date: string;
  isOutgoing: boolean;
  replyToMessageId?: number;
}

export interface TelegramChat {
  id: number;
  title?: string;
  username?: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  participantCount?: number;
  lastMessage?: TelegramMessage;
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