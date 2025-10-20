import React, { useState } from 'react';
import { X, Clock, Send } from 'lucide-react';
import { scheduledMessagesAPI } from '../../services/api';

interface ScheduleMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number | null;
  onScheduled: () => void;
}

export default function ScheduleMessageModal({
  isOpen,
  onClose,
  conversationId,
  onScheduled,
}: ScheduleMessageModalProps) {
  const [messageText, setMessageText] = useState('');
  const [daysDelay, setDaysDelay] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSchedule = async () => {
    if (!conversationId) {
      setError('No conversation selected');
      return;
    }

    if (!messageText.trim()) {
      setError('Message text is required');
      return;
    }

    if (daysDelay < 1) {
      setError('Days delay must be at least 1');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await scheduledMessagesAPI.createScheduledMessage(conversationId, messageText, daysDelay);
      setMessageText('');
      setDaysDelay(1);
      onScheduled();
      onClose();
    } catch (err) {
      console.error('Failed to schedule message:', err);
      setError('Failed to schedule message');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMessageText('');
    setDaysDelay(1);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Schedule Message</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Message Text */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Message Text
              </label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Enter your message..."
                rows={4}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Days Delay */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Send After (Days)
              </label>
              <input
                type="number"
                min="1"
                value={daysDelay}
                onChange={(e) => setDaysDelay(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-2 text-sm text-gray-400">
                Message will be sent {daysDelay} {daysDelay === 1 ? 'day' : 'days'} from now
              </p>
            </div>

            {/* Info */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-300">
                <strong>Note:</strong> The scheduled message will be automatically cancelled if the other party responds before the scheduled time.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-700">
          <button
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={loading || !messageText.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>{loading ? 'Scheduling...' : 'Schedule Message'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
