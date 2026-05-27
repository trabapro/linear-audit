// Client for our Hono backend. The user's PAT is sent in `X-Linear-Pat` per request.
// The PAT only lives in browser localStorage — the backend forwards it to Linear and forgets it.

import type {
  ActionResult,
  AuditCategory,
  AuditDecision,
  LinearIssue,
  LinearMilestone,
  LinearProject,
  LinearUser,
} from '@linear-audit/shared';

const PAT_KEY = 'linear-audit:pat';

export function getStoredPat(): string {
  return localStorage.getItem(PAT_KEY) ?? '';
}

export function storePat(pat: string): void {
  if (pat) localStorage.setItem(PAT_KEY, pat);
  else localStorage.removeItem(PAT_KEY);
}

async function call<T>(path: string, init?: RequestInit & { pat?: string }): Promise<T> {
  const pat = init?.pat ?? getStoredPat();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (pat) headers['X-Linear-Pat'] = pat;

  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  whoami: (pat?: string) => call<LinearUser>('/api/whoami', { pat }),
  projects: () => call<LinearProject[]>('/api/projects'),
  milestones: (projectId: string) =>
    call<LinearMilestone[]>(`/api/projects/${projectId}/milestones`),
  issues: (projectId: string, milestoneId?: string) => {
    const qs = new URLSearchParams({ projectId });
    if (milestoneId) qs.set('milestoneId', milestoneId);
    return call<LinearIssue[]>(`/api/issues?${qs.toString()}`);
  },
  decide: (decision: AuditDecision, categories: AuditCategory[], currentTitle: string) =>
    call<ActionResult>('/api/decisions', {
      method: 'POST',
      body: JSON.stringify({ decision, categories, currentTitle }),
    }),
  distillCategories: (text: string) =>
    call<{ categories: AuditCategory[] }>('/api/distill-categories', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
};
