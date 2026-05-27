import { useAudit } from '@/state/AuditContext';

export function ResultsScreen() {
  const audit = useAudit();

  const reset = () => {
    audit.setIssues([]);
    audit.setPosition(0);
    audit.setProject(null);
    audit.setMilestone(null);
    audit.setPhase('setup');
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 text-slate-100">
      <h1 className="text-3xl font-bold tracking-tight">✨ Audit complete</h1>
      <p className="mt-2 text-slate-300">
        {audit.position} of {audit.issues.length} tickets processed. Linear has the audit trail —
        every action was applied live as you swiped.
      </p>

      <div className="mt-8 grid gap-3">
        <a
          href={`https://linear.app`}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/15"
        >
          Open Linear ↗
        </a>
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-gradient-to-r from-pink-500 to-orange-400 px-5 py-3 text-sm font-bold"
        >
          Start another audit
        </button>
      </div>
    </div>
  );
}
