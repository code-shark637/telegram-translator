import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = ({ title, message, onConfirm, onCancel }: ConfirmDialogProps) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="ml-4 text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <p className="text-gray-600 mb-6">{message}</p>
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
