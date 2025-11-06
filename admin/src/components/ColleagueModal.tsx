import { useState, useEffect } from 'react';
import { X, Key } from 'lucide-react';
import { adminApi } from '../services/api';
import { ColleagueWithAccounts } from '../types';

interface ColleagueModalProps {
  colleague: ColleagueWithAccounts | null;
  onClose: (refresh: boolean) => void;
}

const ColleagueModal = ({ colleague, onClose }: ColleagueModalProps) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    is_active: true,
  });
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (colleague) {
      setFormData({
        username: colleague.username,
        email: colleague.email || '',
        password: '',
        is_active: colleague.is_active,
      });
    }
  }, [colleague]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (colleague) {
        // Update existing colleague
        await adminApi.updateColleague(colleague.id, {
          username: formData.username,
          email: formData.email || undefined,
          is_active: formData.is_active,
        });
      } else {
        // Create new colleague
        if (!formData.password) {
          setError('Password is required for new colleagues');
          setLoading(false);
          return;
        }
        await adminApi.createColleague({
          username: formData.username,
          password: formData.password,
          email: formData.email || undefined,
        });
      }
      onClose(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save colleague');
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!colleague || !newPassword) return;

    setError('');
    setLoading(true);

    try {
      await adminApi.resetColleaguePassword(colleague.id, newPassword);
      setShowPasswordReset(false);
      setNewPassword('');
      alert('Password reset successfully');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {colleague ? 'Edit Colleague' : 'Add Colleague'}
          </h2>
          <button
            onClick={() => onClose(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username *
            </label>
            <input
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {!colleague && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}

          {colleague && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                Active
              </label>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            {colleague && !showPasswordReset && (
              <button
                type="button"
                onClick={() => setShowPasswordReset(true)}
                className="flex items-center text-sm text-blue-600 hover:text-blue-700"
              >
                <Key className="w-4 h-4 mr-1" />
                Reset Password
              </button>
            )}
            <div className="flex space-x-3 ml-auto">
              <button
                type="button"
                onClick={() => onClose(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </form>

        {showPasswordReset && colleague && (
          <div className="border-t border-gray-200 p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Reset Password</h3>
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
            />
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowPasswordReset(false);
                  setNewPassword('');
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordReset}
                disabled={loading || !newPassword}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ColleagueModal;
