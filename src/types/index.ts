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
  type: 'text' | 'photo' | 'video' | 'voice' | 'document' | 'system';
  original_text: string;
  translated_text?: string;
  source_language?: string;
  target_language?: string;
  created_at: string;
  is_outgoing: boolean;
  replyToMessageId?: number;
  has_media?: boolean;
  media_file_name?: string;
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

export interface MessageTemplate {
  id: number;
  user_id: number;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledMessage {
  id: number;
  conversation_id: number;
  message_text: string;
  scheduled_at: string;
  created_at: string;
  is_sent: boolean;
  is_cancelled: boolean;
  sent_at?: string;
  cancelled_at?: string;
}

export interface ContactInfo {
  id: number;
  conversation_id: number;
  name?: string;
  address?: string;
  telephone?: string;
  telegram_id?: string;
  telegram_id2?: string;
  signal_id?: string;
  signal_id2?: string;
  product_interest?: string;
  sales_volume?: string;
  ready_for_sample: boolean;
  sample_recipient_info?: string;
  sample_feedback?: string;
  payment_method?: string;
  delivery_method?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface TelegramUserSearchResult {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  is_contact: boolean;
}