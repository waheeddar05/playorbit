'use client';

import { useState, useCallback, createContext, useContext, type ReactNode, useEffect, useRef } from 'react';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────
interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

// ─── Context ─────────────────────────────────────────────
const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function useConfirm(): ConfirmContextType {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}

// ─── Icon & Color Maps ──────────────────────────────────
const VARIANT_CONFIG = {
  default: {
    icon: CheckCircle,
    iconColor: 'text-accent',
    iconBg: 'bg-accent/10',
    confirmBg: 'bg-accent hover:bg-accent-light',
    confirmText: 'text-primary',
  },
  danger: {
    icon: XCircle,
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/10',
    confirmBg: 'bg-red-500 hover:bg-red-600',
    confirmText: 'text-white',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/10',
    confirmBg: 'bg-amber-500 hover:bg-amber-600',
    confirmText: 'text-white',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    confirmBg: 'bg-blue-500 hover:bg-blue-600',
    confirmText: 'text-white',
  },
};

// ─── Dialog Component ────────────────────────────────────
function Dialog({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const variant = options.variant || 'default';
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setIsVisible(true));
    // Focus cancel button for accessibility
    cancelRef.current?.focus();
  }, []);

  const handleClose = (result: boolean) => {
    setIsVisible(false);
    setTimeout(() => (result ? onConfirm() : onCancel()), 200);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={() => handleClose(false)}
      />

      {/* Dialog */}
      <div
        className={`relative w-full max-w-sm bg-[#132240]/95 backdrop-blur-xl border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden transition-all duration-200 ${
          isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
      >
        <div className="p-6">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl ${config.iconBg} flex items-center justify-center mx-auto mb-4`}>
            <Icon className={`w-6 h-6 ${config.iconColor}`} />
          </div>

          {/* Content */}
          <h3 className="text-lg font-bold text-white text-center mb-2">{options.title}</h3>
          <p className="text-sm text-slate-300 text-center leading-relaxed whitespace-pre-line">
            {options.message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            ref={cancelRef}
            onClick={() => handleClose(false)}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border border-white/[0.1] text-slate-300 hover:bg-white/[0.06] transition-all active:scale-[0.97] cursor-pointer"
          >
            {options.cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={() => handleClose(true)}
            className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] cursor-pointer ${config.confirmBg} ${config.confirmText}`}
          >
            {options.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setDialog({ options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    dialog?.resolve(true);
    setDialog(null);
  };

  const handleCancel = () => {
    dialog?.resolve(false);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <Dialog
          options={dialog.options}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}
