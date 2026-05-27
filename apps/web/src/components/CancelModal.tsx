import { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  identifier: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Quick "Cancel this ticket?" prompt with an optional reason.
 * Enter → confirm (with whatever reason is typed)
 * Esc   → abort
 */
export function CancelModal({ open, identifier, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setReason('');
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onConfirm(reason.trim());
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, reason, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="w-[min(440px,92vw)] rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
        <h3 className="text-lg font-bold">
          Cancel <span className="font-mono text-rose-600">{identifier}</span>?
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Sets the ticket state to Canceled in Linear. Reason is optional — if you add one, it becomes a comment on the ticket.
        </p>

        <textarea
          ref={textareaRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional). e.g. 'not doing this', 'superseded by ENG-XXX', 'out of scope'"
          className="mt-3 min-h-[72px] w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
        />

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
          >
            Never mind (Esc)
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
          >
            Cancel ticket (⏎)
          </button>
        </div>
      </div>
    </div>
  );
}
