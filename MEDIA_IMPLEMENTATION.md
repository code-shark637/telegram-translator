# Media (Images/Videos) Implementation Guide

## Backend Implementation ✅ COMPLETED

### 1. Database Schema
- Added migration file: `backend/database/add_media_fields.sql`
- New fields in `messages` table:
  - `media_file_path` - Path to stored media file
  - `media_file_name` - Original filename
  - `media_mime_type` - MIME type of the file
  - `media_file_size` - File size in bytes
  - `media_thumbnail_path` - Path to thumbnail (for videos)
  - `is_outgoing` - Whether message was sent or received

**Run migration:**
```bash
psql -U your_user -d your_database -f backend/database/add_media_fields.sql
```

### 2. Telethon Service (`telethon_service.py`)
Added methods:
- `send_media(peer_id, file_path, caption)` - Send media files to Telegram
- `download_media(message_id, peer_id, download_path)` - Download media from Telegram
- Updated event handler to detect media types (photo, video, voice, document)

### 3. API Endpoints (`app/features/messages/routes.py`)
- **POST `/api/messages/send-media`** - Upload and send media
  - Accepts file upload via multipart/form-data
  - Saves file temporarily
  - Sends via Telethon
  - Stores message in database
  - Broadcasts via WebSocket

- **GET `/api/messages/download-media/{conversation_id}/{message_id}`** - Download media
  - Query param: `telegram_message_id`
  - Downloads from Telegram on-demand
  - Returns file as download

### 4. Message Handling (`main.py`)
- Updated to handle media messages
- Stores message type (text, photo, video, voice, document)
- Adds `has_media` flag to WebSocket messages

## Frontend Implementation 🔄 TODO

### Required Changes:

### 1. Update TypeScript Types (`src/types/index.ts`)
```typescript
export interface TelegramMessage {
  id: number;
  conversation_id: number;
  telegram_message_id: number;
  sender_user_id?: number;
  sender_name?: string;
  sender_username?: string;
  peer_title: string;
  type: 'text' | 'photo' | 'video' | 'voice' | 'document';
  original_text: string;
  translated_text?: string;
  source_language?: string;
  target_language?: string;
  created_at: string;
  is_outgoing: boolean;
  replyToMessageId?: number;
  has_media?: boolean;  // NEW
}
```

### 2. Update API Service (`src/services/api.ts`)
```typescript
export const messagesAPI = {
  // ... existing methods ...
  
  sendMedia: async (conversationId: number, file: File, caption: string = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversation_id', conversationId.toString());
    formData.append('caption', caption);
    
    const response = await api.post('/messages/send-media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  downloadMedia: (conversationId: number, messageId: number, telegramMessageId: number) => {
    return `/api/messages/download-media/${conversationId}/${messageId}?telegram_message_id=${telegramMessageId}`;
  },
};
```

### 3. Update ChatWindow Component
Add file upload UI:
- Add file input button (paperclip icon)
- Show file preview before sending
- Display upload progress
- Handle image/video file types

### 4. Update MessageBubble Component
Display media messages:
- For photos: Show thumbnail with click to view full size
- For videos: Show video player or thumbnail with play button
- For documents: Show file icon with download button
- Show download button for media messages
- Display loading state while downloading

### 5. Example MessageBubble with Media
```typescript
{message.type === 'photo' && (
  <div className="media-container">
    {message.has_media ? (
      <img 
        src={messagesAPI.downloadMedia(message.conversation_id, message.id, message.telegram_message_id)}
        alt="Photo"
        className="max-w-xs rounded cursor-pointer"
        onClick={() => openFullImage(message)}
      />
    ) : (
      <div className="text-gray-400">📷 Photo (click to download)</div>
    )}
  </div>
)}

{message.type === 'video' && (
  <div className="media-container">
    {message.has_media ? (
      <video 
        controls
        className="max-w-xs rounded"
        src={messagesAPI.downloadMedia(message.conversation_id, message.id, message.telegram_message_id)}
      />
    ) : (
      <div className="text-gray-400">🎥 Video (click to download)</div>
    )}
  </div>
)}
```

## Flow Diagram

### Sending Media:
```
Frontend → Upload File → Backend API
                          ↓
                    Save to temp/uploads
                          ↓
                    Telethon.send_file()
                          ↓
                    Save to database
                          ↓
                    WebSocket broadcast
                          ↓
                    Delete temp file
```

### Receiving Media:
```
Telegram → Telethon Event Handler
              ↓
        Detect media type
              ↓
        Save message (with has_media=true)
              ↓
        WebSocket broadcast
              ↓
        Frontend shows media indicator
              ↓
        User clicks → Download on-demand
              ↓
        Backend downloads from Telegram
              ↓
        Serve file to frontend
```

## Next Steps for Frontend:
1. Add file upload button to ChatWindow
2. Create MediaMessage component for displaying media
3. Implement file preview before sending
4. Add download functionality for received media
5. Handle loading states and errors
6. Add image/video viewer modal

## Dependencies to Install:
```bash
# Backend (already added)
pip install aiofiles

# Frontend
npm install lucide-react  # Already installed (for icons)
```
