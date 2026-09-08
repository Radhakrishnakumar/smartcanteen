import React from 'react';

export interface StatusBadgeProps {
  status: 'success' | 'warning' | 'info' | 'error' | 'neutral';
  children: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = 'neutral',
  children,
  icon,
  size = 'md',
}) => {
  const styles = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 rounded-md',
    md: 'text-xs px-2.5 py-1 gap-1.5 rounded-lg',
  };

  return (
    <span className={`inline-flex items-center font-semibold border ${styles[status]} ${sizes[size]}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
