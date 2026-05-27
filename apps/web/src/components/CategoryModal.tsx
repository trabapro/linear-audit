import { useEffect, useRef, useState } from 'react';
import { useAudit } from '@/state/AuditContext';
import type { AuditCategory } from '@linear-audit/shared';

interface Props {
  open: boolean;
  initialCategoryIds: string[];
  identifier: string;
  onConfirm: (categoryIds: string[], note: string) => void;
  onCancel: () => void;
}

export function CategoryModal({ open, initialCategoryIds, identifier, onConfirm, onCancel }: Props) {
  const audit = useAudit();
  const [picked, setPicked] = useState<Set<string>>(new Set(initialCategoryIds));
  const [newLabel, setNewLabel] = useState('');
  const [note, setNote] = useState('');
  const noteRef = useRef<HTMLTextAreaElement | null>(null);
  const newLabelRef = useRef<HTMLInputElement | null>(null);

  // Reset on each open
  useEffect(() => {
    if (open) {
      setPicked(new Set(initialCategoryIds));
      setNote('');
      setNewLabel('');
      setTimeout(() => noteRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Only treat number/Enter/Esc shortcuts when not actively typing in the new-category field
      const inNewLabel = document.activeElement === newLabelRef.current;
      if (!inNewLabel && e.key >= '1' && e.key <= '9') {
        const idx = Number.parseInt(e.key, 10) - 1;
        const cat = audit.categories[idx];
        if (cat) {
          togglePicked(cat.id);
          e.preventDefault();
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (inNewLabel) {
          if (newLabel.trim()) {
            const c = audit.addCategory(newLabel.trim());
            setPicked((p) => new Set(p).add(c.id));
            setNewLabel('');
          }
        } else {
          e.preventDefault();
          confirm();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const togglePicked = (id: string) => {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = () => {
    if (picked.size === 0) return;
    onConfirm(Array.from(picked), note.trim());
  };

  const addInlineCategory = () => {
    if (!newLabel.trim()) return;
    const c = audit.addCategory(newLabel.trim());
    setPicked((p) => new Set(p).add(c.id));
    setNewLabel('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="w-[min(480px,92vw)] rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
        <h3 className="text-lg font-bold">
          Categorize <span className="font-mono text-pink-600">{identifier}</span>
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Number keys select. Pick one or more — categories get prefixed to the ticket title.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {audit.categories.map((c, idx) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => togglePicked(c.id)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition ${
                  picked.has(c.id)
                    ? 'border-pink-500 bg-pink-50'
                    : 'border-transparent bg-slate-100 hover:bg-slate-200'
                }`}
              >
                <span className="grid h-7 w-7 place-items-center rounded-md bg-white text-xs font-bold shadow">
                  {idx + 1 <= 9 ? idx + 1 : ''}
                </span>
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: c.color ?? '#8b5cf6' }}
                />
                <span className="flex-1 text-sm font-medium">
                  {c.emoji ? `${c.emoji} ` : ''}
                  {c.label}
                </span>
                {c.isCustom && (
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-600">
                    custom
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex gap-2">
          <input
            ref={newLabelRef}
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="New category — Enter to add"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={addInlineCategory}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            + Add
          </button>
        </div>

        <textarea
          ref={noteRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note (becomes a Linear comment). e.g. 'assign to will', 'mark urgent'"
          className="mt-3 min-h-[60px] w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={picked.size === 0}
            className="rounded-lg bg-pink-500 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirm ({picked.size}) ⏎
          </button>
        </div>
      </div>
    </div>
  );
}
