import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api';
import { useAudit } from '@/state/AuditContext';
import { recommend, type Recommendation } from '@/lib/recommend';
import { SwipeCard } from './SwipeCard';
import { CategoryModal } from './CategoryModal';
import type { AuditDecision, ActionResult } from '@linear-audit/shared';

type SwipeAnim = 'left' | 'right' | null;

export function SwipeScreen() {
  const audit = useAudit();
  const [modalOpen, setModalOpen] = useState(false);
  const [anim, setAnim] = useState<SwipeAnim>(null);
  const [history, setHistory] = useState<{ decision: AuditDecision; result: ActionResult }[]>([]);
  const topRef = useRef<HTMLDivElement | null>(null);

  const current = audit.issues[audit.position];
  const next = audit.issues[audit.position + 1];
  const overNext = audit.issues[audit.position + 2];

  const rec: Recommendation | null = useMemo(() => (current ? recommend(current) : null), [current]);

  // Map hint → category
  const hintCategoryId = useMemo(() => {
    if (!rec?.categoryHint) return undefined;
    return audit.categories.find((c) => c.label.toLowerCase() === rec.categoryHint?.toLowerCase())?.id;
  }, [rec, audit.categories]);

  // Keyboard
  useEffect(() => {
    if (modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        beginPending();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        commitClose();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        commitSkip();
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        undo();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const el = topRef.current?.querySelector('.overflow-y-auto') as HTMLElement | null;
        if (el) el.scrollBy({ top: e.key === 'ArrowDown' ? 80 : -80, behavior: 'smooth' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!current) {
    // Move to results phase
    setTimeout(() => audit.setPhase('done'), 0);
    return null;
  }

  function beginPending() {
    setModalOpen(true);
  }

  async function commitClose() {
    const action = rec?.action === 'close' ? 'close' : 'cancel';
    // For right-swipes on tickets we recommended pending, treat as cancel rather than done.
    const decision: AuditDecision = {
      issueId: current!.id,
      identifier: current!.identifier,
      action,
      decidedAt: new Date().toISOString(),
      recommendation: { action: rec?.action ?? 'pending', categoryIds: hintCategoryId ? [hintCategoryId] : undefined, note: rec?.rationale },
    };
    await runDecision(decision, 'right');
  }

  async function commitSkip() {
    const decision: AuditDecision = {
      issueId: current!.id,
      identifier: current!.identifier,
      action: 'skip',
      decidedAt: new Date().toISOString(),
    };
    await runDecision(decision, 'left');
  }

  async function commitPending(categoryIds: string[], note: string) {
    setModalOpen(false);
    const decision: AuditDecision = {
      issueId: current!.id,
      identifier: current!.identifier,
      action: 'pending',
      categoryIds,
      note: note || undefined,
      decidedAt: new Date().toISOString(),
      recommendation: { action: rec?.action ?? 'pending', categoryIds: hintCategoryId ? [hintCategoryId] : undefined, note: rec?.rationale },
    };
    await runDecision(decision, 'left');
  }

  async function runDecision(decision: AuditDecision, direction: 'left' | 'right') {
    setAnim(direction);
    audit.setToast('Working…');
    try {
      const result = await api.decide(decision, audit.categories, current!.title);
      setHistory((h) => [...h, { decision, result }]);
      audit.setToast(
        result.ok
          ? result.performed.length > 0
            ? `✓ ${result.performed.join(' · ')}`
            : '✓ Done'
          : `✗ ${result.error}`,
      );
    } catch (e) {
      audit.setToast(`✗ ${(e as Error).message}`);
    }
    setTimeout(() => {
      setAnim(null);
      audit.setPosition(audit.position + 1);
    }, 280);
  }

  async function undo() {
    // Reverse the last decision optimistically: just step the deck back.
    // We don't undo Linear-side actions — Linear keeps the history natively.
    if (audit.position === 0) return;
    audit.setPosition(audit.position - 1);
    audit.setToast('↶ Stepped back (Linear actions are not reverted automatically)');
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-3 backdrop-blur-md">
        <div>
          <h1 className="text-lg font-bold">Linear Audit</h1>
          <p className="text-xs text-slate-300">
            {audit.project?.name}
            {audit.milestone ? ` · ${audit.milestone.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-orange-400 transition-all"
              style={{ width: `${(audit.position / audit.issues.length) * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs">
            {Math.min(audit.position + 1, audit.issues.length)} / {audit.issues.length}
          </span>
          <button
            type="button"
            onClick={undo}
            className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/20"
          >
            ↶ Undo
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-2">
        <div ref={topRef} className="relative mx-auto h-[min(72vh,660px)] w-full max-w-[460px]">
          {overNext && (
            <SwipeCard
              key={overNext.id}
              issue={overNext}
              rec={recommend(overNext)}
              className="scale-[0.88] translate-y-7 opacity-30 pointer-events-none"
            />
          )}
          {next && (
            <SwipeCard
              key={next.id}
              issue={next}
              rec={recommend(next)}
              className="scale-[0.94] translate-y-3 opacity-60 pointer-events-none"
            />
          )}
          {current && rec && (
            <SwipeCard
              key={current.id}
              issue={current}
              rec={rec}
              className={anim ? `card-swipe-${anim}` : ''}
            />
          )}
        </div>

        <div className="mt-5 flex justify-center gap-4">
          <button
            type="button"
            onClick={beginPending}
            className="rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg"
          >
            ← Pending
          </button>
          <button
            type="button"
            onClick={commitSkip}
            className="rounded-xl bg-white/15 px-5 py-3 text-sm font-bold text-white"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={commitClose}
            className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 px-5 py-3 text-sm font-bold text-white shadow-lg"
          >
            Close →
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">
          ← pending · → close · ↑↓ scroll · S skip · U undo · 1-9 categories in modal
        </p>
      </main>

      {audit.toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/90 px-4 py-2 text-sm font-semibold text-white shadow-xl">
          {audit.toast}
        </div>
      )}

      <CategoryModal
        open={modalOpen}
        initialCategoryIds={hintCategoryId ? [hintCategoryId] : []}
        identifier={current.identifier}
        onConfirm={commitPending}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  );
}
