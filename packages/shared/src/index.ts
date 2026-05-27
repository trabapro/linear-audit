// Shared types between the swipe UI and the Linear-proxy backend.

export type LinearWorkflowStateType =
  | 'triage'
  | 'backlog'
  | 'unstarted'
  | 'started'
  | 'completed'
  | 'canceled';

export type LinearPriority = 0 | 1 | 2 | 3 | 4;
// 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low

export interface LinearProject {
  id: string;
  name: string;
  slugId: string;
  description: string | null;
  url: string;
}

export interface LinearMilestone {
  id: string;
  name: string;
  description: string | null;
  targetDate: string | null;
}

export interface LinearUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  displayName: string;
}

export interface LinearIssueRef {
  id: string;
  identifier: string;
  title: string;
  url: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: LinearPriority;
  priorityLabel: string;
  url: string;
  state: {
    id: string;
    name: string;
    type: LinearWorkflowStateType;
  };
  assignee: LinearUser | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  /** Parent issue, if this is a sub-issue. Pulled from Linear regardless of audit scope. */
  parent: LinearIssueRef | null;
  /**
   * Number of open child issues that are present in the current audit set
   * (same project + open workflow state). Computed server-side after the
   * issue list is fetched, so it reflects what the user will actually see
   * in the deck — not Linear's total child count.
   */
  childrenInScope: number;
}

// User-defined category. The label is what's prefixed to ticket titles.
export interface AuditCategory {
  id: string; // stable client-side ID (uuid)
  label: string; // shown in UI and prefixed to title
  emoji?: string; // optional decoration
  description?: string; // hover text
  color?: string; // hex; used for visual chip
  isCustom: boolean; // user-defined vs preset
}

export const DEFAULT_CATEGORIES: Omit<AuditCategory, 'id' | 'isCustom'>[] = [
  { label: 'bug', emoji: '🐛', color: '#fbbf24', description: 'Discrete bug' },
  { label: 'qol', emoji: '✨', color: '#6BCB77', description: 'Quality-of-life improvement' },
  { label: 'automation', emoji: '🤖', color: '#06b6d4', description: 'Automation / integration' },
  { label: 'filtering', emoji: '🔍', color: '#84cc16', description: 'Filtering / UX' },
  { label: 'setup', emoji: '🔧', color: '#a78bfa', description: 'Setup / configuration work' },
];

// One decision the user made while swiping.
export type DecisionAction = 'close' | 'cancel' | 'pending' | 'skip';

export interface AuditDecision {
  issueId: string;
  identifier: string;
  action: DecisionAction;
  // For 'pending': which categories to apply (titles get prefixed).
  categoryIds?: string[];
  // For 'close' or 'cancel': optional duplicateOf identifier.
  duplicateOf?: string;
  // Optional free-text note appended as a Linear comment.
  note?: string;
  // The recommendation that was shown to the user; useful for analytics.
  recommendation?: {
    action: DecisionAction;
    categoryIds?: string[];
    note?: string;
  };
  decidedAt: string; // ISO
}

// Action result returned from the backend after executing a decision.
export interface ActionResult {
  ok: boolean;
  issueId: string;
  identifier: string;
  performed: string[]; // human-readable list of what got done
  error?: string;
}

// Session config the user sets up before swiping.
export interface AuditSession {
  pat: string; // Linear PAT (kept client-side; sent per-request)
  projectId: string;
  projectName: string;
  milestoneId?: string;
  milestoneName?: string;
  categories: AuditCategory[];
}

// Title-prefix helpers.
// Format: `[cat1, cat2] Original title`. Replaces an existing prefix if present.
export const CATEGORY_PREFIX_REGEX = /^\[([^\]]+)\]\s+/;

export function buildTitleWithCategories(originalTitle: string, categoryLabels: string[]): string {
  const stripped = originalTitle.replace(CATEGORY_PREFIX_REGEX, '');
  if (categoryLabels.length === 0) return stripped;
  return `[${categoryLabels.join(', ')}] ${stripped}`;
}

export function parseCategoriesFromTitle(title: string): { categories: string[]; stripped: string } {
  const match = title.match(CATEGORY_PREFIX_REGEX);
  if (!match || !match[1]) return { categories: [], stripped: title };
  const categories = match[1].split(',').map((c) => c.trim()).filter(Boolean);
  const stripped = title.replace(CATEGORY_PREFIX_REGEX, '');
  return { categories, stripped };
}
