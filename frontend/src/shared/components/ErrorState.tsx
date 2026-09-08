import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'Failed to load content. Please check your connection.',
  onRetry,
}) => {
  return (
    <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-slate-800 flex flex-col items-center text-center max-w-md mx-auto my-6">
      <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
      <h4 className="text-sm font-bold text-red-900 mb-1">{title}</h4>
      <p className="text-xs text-red-700 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
};
