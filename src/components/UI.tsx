import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CircleDashed,
  Sparkles,
  FileDown,
  Layers,
} from 'lucide-react';
import type { DocumentStatus } from '../types/domain';

export const PageHeader: React.FC<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => (
  <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-indigo-100 mb-6">
    <div>
      <h1 className="font-display text-2xl sm:text-[26px] font-bold tracking-tight text-slate-900 text-balance">
        {title}
      </h1>
      {description && (
        <p className="mt-1 text-sm text-slate-600 max-w-3xl">{description}</p>
      )}
    </div>
    {actions && (
      <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
    )}
  </div>
);

export const SegmentedTabs: React.FC<{
  tabs: Array<{ id: string; label: string; count?: number }>;
  activeTab: string;
  onChange: (id: string) => void;
}> = ({ tabs, activeTab, onChange }) => (
  <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white/90 border border-indigo-100 rounded-xl shadow-xs mb-6">
    {tabs.map((tab) => {
      const active = tab.id === activeTab;
      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 flex items-center gap-2 ${
            active
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-indigo-900 hover:bg-indigo-50/70'
          }`}
        >
          <span>{tab.label}</span>
          {typeof tab.count === 'number' && (
            <span
              className={`font-mono text-xs tabular-nums ${
                active ? 'text-blue-100' : 'text-slate-500'
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export const StatusText: React.FC<{ status: DocumentStatus }> = ({ status }) => {
  if (status === 'Selesai') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>Selesai</span>
      </span>
    );
  }
  if (status === 'Dalam proses') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Dalam proses</span>
      </span>
    );
  }
  if (status === 'Perlu diperbaiki') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>Perlu diperbaiki</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
      <CircleDashed className="w-3.5 h-3.5 shrink-0" />
      <span>Belum dibuat</span>
    </span>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="bg-white/95 border border-indigo-100 rounded-xl overflow-hidden shadow-xs">
    <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-indigo-500 to-teal-500" />
    <div className="p-10 text-center">
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white mx-auto mb-3.5 flex items-center justify-center shadow-xs">
        <Layers className="w-5 h-5" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-xs transition-all duration-150 whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  </div>
);

export const PrimaryButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }
> = ({ children, loading, className = '', disabled, ...rest }) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={`px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-all duration-150 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${className}`}
    {...rest}
  >
    {loading ? 'Memproses...' : children}
  </button>
);

export const SecondaryButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement>
> = ({ children, className = '', ...rest }) => (
  <button
    type="button"
    className={`px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-900 disabled:opacity-50 rounded-lg transition-all duration-150 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${className}`}
    {...rest}
  >
    {children}
  </button>
);

export const AiActionButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }
> = ({ children, loading, className = '', disabled, ...rest }) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={`px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 hover:from-teal-700 hover:via-emerald-700 hover:to-cyan-700 disabled:opacity-50 rounded-lg shadow-xs transition-all duration-150 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${className}`}
    {...rest}
  >
    <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
    <span>{loading ? 'Menyusun Draft AI...' : children}</span>
  </button>
);

export const DocxButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { label?: string }
> = ({ label = 'Unduh DOCX', className = '', ...rest }) => (
  <button
    type="button"
    className={`px-3.5 py-2 text-sm font-medium text-indigo-900 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 disabled:opacity-50 rounded-lg transition-all duration-150 inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 ${className}`}
    {...rest}
  >
    <FileDown className="w-4 h-4 text-indigo-700 shrink-0" />
    <span>{label}</span>
  </button>
);

export const FormField: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-slate-700">
      {label}
      {required && <span className="text-rose-600 ml-0.5">*</span>}
    </label>
    {children}
    {hint && <span className="text-xs text-slate-500">{hint}</span>}
  </div>
);

export const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-600 transition-colors';
