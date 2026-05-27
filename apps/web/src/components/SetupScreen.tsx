import { useEffect, useState } from 'react';
import { api, getStoredPat, storePat } from '@/api';
import { useAudit } from '@/state/AuditContext';
import type { LinearMilestone, LinearProject, LinearUser } from '@linear-audit/shared';

export function SetupScreen() {
  const audit = useAudit();
  const [pat, setPat] = useState<string>(audit.pat || getStoredPat());
  const [user, setUser] = useState<LinearUser | null>(null);
  const [projects, setProjects] = useState<LinearProject[]>([]);
  const [milestones, setMilestones] = useState<LinearMilestone[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [milestoneId, setMilestoneId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingMilestones, setLoadingMilestones] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [goalsText, setGoalsText] = useState<string>(
    () => localStorage.getItem('linear-audit:goals') ?? '',
  );
  const [distilling, setDistilling] = useState(false);
  const [distillErr, setDistillErr] = useState<string | null>(null);

  // Auto-load projects once PAT is verified.
  useEffect(() => {
    if (!pat) return;
    setErr(null);
    api
      .whoami(pat)
      .then((u) => {
        setUser(u);
        storePat(pat);
        audit.setPat(pat);
        setLoadingProjects(true);
        return api.projects();
      })
      .then((ps) => {
        setProjects(ps);
        setLoadingProjects(false);
      })
      .catch((e: Error) => {
        setUser(null);
        setProjects([]);
        setErr(e.message);
        setLoadingProjects(false);
      });
  }, [pat]);

  // Load milestones when a project is picked.
  useEffect(() => {
    if (!projectId) {
      setMilestones([]);
      setMilestoneId('');
      return;
    }
    setLoadingMilestones(true);
    api
      .milestones(projectId)
      .then((ms) => {
        setMilestones(ms);
        setLoadingMilestones(false);
      })
      .catch(() => {
        setMilestones([]);
        setLoadingMilestones(false);
      });
  }, [projectId]);

  const canStart = !!user && !!projectId && audit.categories.length > 0;

  const start = async () => {
    if (!canStart) return;
    const project = projects.find((p) => p.id === projectId);
    const milestone = milestoneId ? milestones.find((m) => m.id === milestoneId) ?? null : null;
    if (!project) return;
    audit.setProject(project);
    audit.setMilestone(milestone);
    setLoadingIssues(true);
    setErr(null);
    try {
      const issues = await api.issues(project.id, milestone?.id);
      audit.setIssues(issues);
      audit.setPosition(0);
      audit.setPhase('swiping');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoadingIssues(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 text-slate-100">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Linear Audit</h1>
        <p className="mt-2 text-slate-300">
          Connect Linear, pick a project, define your categories, and start swiping.
        </p>
      </header>

      {/* Step 1: PAT */}
      <Section step="1" title="Connect Linear">
        <p className="mb-3 text-sm text-slate-400">
          Paste a Linear personal access token from{' '}
          <a className="underline" href="https://linear.app/settings/api" target="_blank" rel="noreferrer">
            linear.app/settings/api
          </a>
          . Stays in your browser; backend just forwards it to Linear.
        </p>
        <input
          type="password"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          placeholder="lin_api_…"
          className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 font-mono text-sm focus:border-pink-400 focus:outline-none"
        />
        {user && (
          <div className="mt-2 text-sm text-emerald-400">✓ Connected as {user.displayName || user.name}</div>
        )}
        {err && <div className="mt-2 text-sm text-rose-400">{err}</div>}
      </Section>

      {/* Step 2: Project + milestone */}
      <Section step="2" title="Pick a project" disabled={!user}>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={!user || loadingProjects}
          className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="">
            {loadingProjects ? 'Loading projects…' : 'Select a project'}
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {projectId && (
          <select
            value={milestoneId}
            onChange={(e) => setMilestoneId(e.target.value)}
            disabled={loadingMilestones}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">
              {loadingMilestones ? 'Loading milestones…' : 'All milestones (optional filter)'}
            </option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
      </Section>

      {/* Step 3: Categories */}
      <Section step="3" title="Set your categories" disabled={!projectId}>
        <p className="mb-3 text-sm text-slate-400">
          These get prefixed to the ticket title when you left-swipe. Add, remove, or distill from free-text goals — anything goes.
        </p>

        {/* Distill from free text */}
        <div className="mb-4 rounded-xl border border-pink-500/30 bg-pink-500/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pink-300">
            ✨ Distill from your goals
          </div>
          <textarea
            value={goalsText}
            onChange={(e) => setGoalsText(e.target.value)}
            placeholder="e.g. 'My P0 is shipping the new auth flow. P1 is reducing flaky tests. P2 is migrating off Stripe.' — Claude turns this into categories."
            className="min-h-[72px] w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm focus:border-pink-400 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">
              {distillErr ? <span className="text-rose-400">{distillErr}</span> : 'Replaces your current category list.'}
            </span>
            <button
              type="button"
              disabled={!goalsText.trim() || distilling}
              onClick={async () => {
                setDistilling(true);
                setDistillErr(null);
                try {
                  const { categories } = await api.distillCategories(goalsText);
                  if (categories.length === 0) {
                    setDistillErr('No categories distilled — try adding more detail.');
                  } else {
                    audit.setCategories(categories);
                    localStorage.setItem('linear-audit:goals', goalsText);
                  }
                } catch (e) {
                  setDistillErr((e as Error).message);
                } finally {
                  setDistilling(false);
                }
              }}
              className="rounded-lg bg-pink-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {distilling ? 'Distilling…' : 'Distill ✨'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {audit.categories.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1 text-xs font-medium"
              style={{ borderLeft: `4px solid ${c.color ?? '#8b5cf6'}` }}
              title={c.description}
            >
              {c.emoji && <span>{c.emoji}</span>}
              {c.label}
              <button
                type="button"
                onClick={() =>
                  audit.setCategories(audit.categories.filter((cc) => cc.id !== c.id))
                }
                className="opacity-60 hover:opacity-100"
                aria-label="Remove"
              >
                ✕
              </button>
            </span>
          ))}
          {audit.categories.length === 0 && (
            <span className="text-xs text-slate-500">
              No categories yet — distill from goals above, or add one below.
            </span>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newCategoryLabel}
            onChange={(e) => setNewCategoryLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCategoryLabel.trim()) {
                audit.addCategory(newCategoryLabel.trim());
                setNewCategoryLabel('');
              }
            }}
            placeholder="Add a category — Enter to add"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm focus:border-pink-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (newCategoryLabel.trim()) {
                audit.addCategory(newCategoryLabel.trim());
                setNewCategoryLabel('');
              }
            }}
            className="rounded-lg bg-pink-500 px-4 py-2 text-sm font-semibold hover:bg-pink-400"
          >
            Add
          </button>
        </div>
      </Section>

      <button
        type="button"
        disabled={!canStart || loadingIssues}
        onClick={start}
        className="mt-8 w-full rounded-xl bg-gradient-to-r from-pink-500 to-orange-400 px-6 py-4 text-base font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loadingIssues ? 'Loading tickets…' : 'Start swiping →'}
      </button>
    </div>
  );
}

function Section({
  step,
  title,
  children,
  disabled,
}: {
  step: string;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <section
      className={`mb-6 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-300">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-pink-500 text-white">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
