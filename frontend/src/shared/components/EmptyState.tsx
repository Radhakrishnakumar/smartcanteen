import React from 'react';
import { PackageOpen } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No items found',
  description = 'There are no active items to display right now.',
  action,
  icon = <PackageOpen className="w-10 h-10 text-slate-400" />,
}) => {
  return (
    <div className="py-12 px-4 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h4 className="text-sm font-bold text-slate-800 mb-1">{title}</h4>
      <p className="text-xs text-slate-500 mb-5 leading-relaxed">{description}</p>
      {action}
    </div>
  );
};
