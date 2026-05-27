// Lightweight per-ticket recommendation. The user can always override.
// Heuristics from the v0 audit, generalized.

import type { LinearIssue } from '@linear-audit/shared';

export type Recommendation = {
  action: 'close' | 'pending';
  rationale: string;
  // If pending, this is a category label hint (the user's category list may not contain it).
  categoryHint?: string;
};

const STALENESS_DAYS = 60;

export function recommend(issue: LinearIssue): Recommendation {
  const title = issue.title.toLowerCase();
  const status = issue.state.type;

  // Backlog tickets older than X days: candidates for closing.
  if (status === 'backlog') {
    const updated = new Date(issue.updatedAt).getTime();
    const ageDays = (Date.now() - updated) / (1000 * 60 * 60 * 24);
    if (ageDays > STALENESS_DAYS) {
      return {
        action: 'close',
        rationale: `Stale (no activity for ${Math.round(ageDays)} days). Probably worth closing.`,
      };
    }
  }

  // Title heuristics — surface common categories so the user can take or leave.
  if (/\bbug\b|broken|wrong|error|crash|fix\b/.test(title)) {
    return { action: 'pending', rationale: 'Title suggests a bug.', categoryHint: 'bug' };
  }
  if (/\bautomate|integrate|integration|automation\b/.test(title)) {
    return { action: 'pending', rationale: 'Title suggests an automation.', categoryHint: 'automation' };
  }
  if (/\bfilter|view|column|sort|show |hide\b/.test(title)) {
    return { action: 'pending', rationale: 'Title suggests filtering/UX work.', categoryHint: 'filtering' };
  }
  if (/\bsetup|configure|onboarding|flow\b/.test(title)) {
    return { action: 'pending', rationale: 'Title suggests setup/configuration work.', categoryHint: 'setup' };
  }
  return { action: 'pending', rationale: 'No strong signal — pick a category.' };
}
