import type { LinearIssue } from '@linear-audit/shared';
import type { Recommendation } from '@/lib/recommend';

interface Props {
  issue: LinearIssue;
  rec: Recommendation;
  className?: string;
}

export function SwipeCard({ issue, rec, className = '' }: Props) {
  const banner =
    rec.action === 'close'
      ? { tone: 'done', label: '✅ Looks done — verify & close' }
      : { tone: 'pending', label: '⏳ Pending — categorize' };

  return (
    <article
      className={`absolute inset-0 flex flex-col overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl ${className}`}
    >
      <header
        className={`px-5 py-3 text-xs font-bold uppercase tracking-wider text-white ${
          banner.tone === 'done'
            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
            : 'bg-gradient-to-r from-amber-500 to-rose-500'
        }`}
      >
        {banner.label}
        {rec.categoryHint && (
          <span className="ml-2 rounded bg-white/25 px-2 py-0.5 text-[10px] normal-case tracking-normal">
            hint: {rec.categoryHint}
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-slate-500">{issue.identifier}</span>
          <Chip label={issue.state.name} tone={stateTone(issue.state.type)} />
          <Chip label={issue.priorityLabel} tone={priorityTone(issue.priority)} />
        </div>

        <h2 className="mb-1 text-xl font-bold leading-snug tracking-tight">{issue.title}</h2>
        <p className="mb-4 text-xs text-slate-500">
          {issue.assignee ? `👤 ${issue.assignee.displayName ?? issue.assignee.name}` : 'Unassigned'}
        </p>

        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
          <b className="text-amber-900">My read:</b> {rec.rationale}
        </div>

        <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Description</div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {issue.description?.slice(0, 4000) || '_(no description)_'}
        </p>

        <a
          href={issue.url}
          target="_blank"
          rel="noreferrer"
          className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
        >
          Open in Linear ↗
        </a>
      </div>
    </article>
  );
}

function Chip({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tone}`}>{label}</span>
  );
}

function stateTone(type: LinearIssue['state']['type']): string {
  switch (type) {
    case 'triage':
      return 'bg-rose-100 text-rose-800';
    case 'backlog':
      return 'bg-slate-200 text-slate-700';
    case 'started':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-amber-100 text-amber-800';
  }
}

function priorityTone(p: LinearIssue['priority']): string {
  switch (p) {
    case 1:
      return 'bg-rose-200 text-rose-900';
    case 2:
      return 'bg-orange-200 text-orange-900';
    case 3:
      return 'bg-amber-100 text-amber-900';
    case 4:
      return 'bg-emerald-100 text-emerald-900';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}
