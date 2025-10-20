import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, Save } from 'lucide-react';
import { templatesAPI } from '../../services/api';
import type { MessageTemplate } from '../../types';

interface MessageTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MessageTemplatesModal({ isOpen, onClose }: MessageTemplatesModalProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ name: '', content: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await templatesAPI.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      setError('Name and content are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const newTemplate = await templatesAPI.createTemplate(formData.name, formData.content);
      setTemplates([...templates, newTemplate]);
      setFormData({ name: '', content: '' });
      setIsCreating(false);
    } catch (err) {
      console.error('Failed to create template:', err);
      setError('Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!formData.name.trim() || !formData.content.trim()) {
      setError('Name and content are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const updated = await templatesAPI.updateTemplate(id, formData);
      setTemplates(templates.map(t => t.id === id ? updated : t));
      setEditingId(null);
      setFormData({ name: '', content: '' });
    } catch (err) {
      console.error('Failed to update template:', err);
      setError('Failed to update template');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      setLoading(true);
      setError(null);
      await templatesAPI.deleteTemplate(id);
      setTemplates(templates.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to delete template:', err);
      setError('Failed to delete template');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (template: MessageTemplate) => {
    setEditingId(template.id);
    setFormData({ name: template.name, content: template.content });
    setIsCreating(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData({ name: '', content: '' });
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Message Templates</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Create New Button */}
          {!isCreating && !editingId && (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full mb-4 p-4 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-blue-500 transition-colors flex items-center justify-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Create New Template</span>
            </button>
          )}

          {/* Create Form */}
          {isCreating && (
            <div className="mb-4 p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h3 className="text-white font-medium mb-3">New Template</h3>
              <input
                type="text"
                placeholder="Template Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full mb-3 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <textarea
                placeholder="Template Content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={4}
                className="w-full mb-3 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleCreate}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded transition-colors flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Save</span>
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Templates List */}
          {loading && templates.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No templates yet. Create your first template!</div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                  {editingId === template.id ? (
                    <>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full mb-3 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <textarea
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        rows={4}
                        className="w-full mb-3 px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleUpdate(template.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded transition-colors flex items-center space-x-2"
                        >
                          <Save className="w-4 h-4" />
                          <span>Save</span>
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={loading}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white rounded transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-white font-medium">{template.name}</h4>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => startEdit(template)}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(template.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-300 text-sm whitespace-pre-wrap">{template.content}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Updated: {new Date(template.updated_at).toLocaleString()}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
