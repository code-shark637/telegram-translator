export interface User {
  id: number;
  username: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface TelegramAccount {
  id: number;
  user_id: number;
  display_name: string;
  account_name: string;
  is_active: boolean;
  source_language: string;
  target_language: string;
  created_at: string;
  last_used?: string;
}

export interface Conversation {
  id: number;
  telegram_account_id: number;
  telegram_peer_id: number;
  title: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  is_archived: boolean;
  created_at: string;
  last_message_at?: string;
  account_telegram_user_id?: number;
  account_id?: number;
  account_name?: string;
  colleague_username?: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  telegram_message_id?: number;
  sender_user_id?: number;
  sender_name: string;
  sender_username: string;
  type: 'text' | 'photo' | 'video' | 'voice' | 'document' | 'sticker' | 'system' | 'auto_reply';
  original_text?: string;
  translated_text?: string;
  source_language?: string;
  target_language?: string;
  created_at: string;
  is_outgoing: boolean;
  has_media: boolean;
  media_file_name?: string;
}

export interface ColleagueWithAccounts extends User {
  accounts: TelegramAccount[];
  total_messages: number;
  total_conversations: number;
}
