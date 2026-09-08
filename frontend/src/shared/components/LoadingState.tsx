import React from 'react';

export interface LoadingStateProps {
  message?: string;
  type?: 'spinner' | 'skeleton';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  type = 'spinner',
}) => {
  if (type === 'skeleton') {
    return (
      <div className="w-full space-y-4 animate-pulse">
        <div className="h-6 bg-slate-200 rounded-md w-1/3"></div>
        <div className="h-24 bg-slate-200 rounded-xl w-full"></div>
        <div className="h-24 bg-slate-200 rounded-xl w-full"></div>
      </div>
    );
  }

  return (
    <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
      <div className="w-7 h-7 border-2 border-slate-200 border-t-rose-600 rounded-full animate-spin"></div>
      <p className="text-xs font-medium text-slate-600">{message}</p>
    </div>
  );
};
