import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  DEFAULT_CATEGORIES,
  type AuditCategory,
  type LinearIssue,
  type LinearProject,
  type LinearMilestone,
} from '@linear-audit/shared';

interface AuditState {
  // Setup
  pat: string;
  setPat: (pat: string) => void;
  project: LinearProject | null;
  setProject: (p: LinearProject | null) => void;
  milestone: LinearMilestone | null;
  setMilestone: (m: LinearMilestone | null) => void;
  categories: AuditCategory[];
  setCategories: (cs: AuditCategory[]) => void;
  addCategory: (label: string, opts?: Partial<AuditCategory>) => AuditCategory;

  // Phase
  phase: 'setup' | 'swiping' | 'done';
  setPhase: (phase: AuditState['phase']) => void;

  // Issues
  issues: LinearIssue[];
  setIssues: (issues: LinearIssue[]) => void;
  position: number;
  setPosition: (n: number) => void;

  // Toast
  toast: string | null;
  setToast: (msg: string | null) => void;
}

const AuditContext = createContext<AuditState | null>(null);

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function defaultCategories(): AuditCategory[] {
  return DEFAULT_CATEGORIES.map((c) => ({ ...c, id: makeId(), isCustom: false }));
}

export function AuditProvider({ children }: { children: ReactNode }) {
  const [pat, setPat] = useState<string>('');
  const [project, setProject] = useState<LinearProject | null>(null);
  const [milestone, setMilestone] = useState<LinearMilestone | null>(null);
  const [categories, setCategories] = useState<AuditCategory[]>(defaultCategories());
  const [phase, setPhase] = useState<AuditState['phase']>('setup');
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [position, setPosition] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const addCategory = (label: string, opts?: Partial<AuditCategory>): AuditCategory => {
    const trimmed = label.trim();
    const existing = categories.find((c) => c.label.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing;
    const cat: AuditCategory = {
      id: makeId(),
      label: trimmed,
      isCustom: true,
      ...opts,
    };
    setCategories((cs) => [...cs, cat]);
    return cat;
  };

  const value = useMemo(
    () => ({
      pat, setPat,
      project, setProject,
      milestone, setMilestone,
      categories, setCategories, addCategory,
      phase, setPhase,
      issues, setIssues,
      position, setPosition,
      toast, setToast,
    }),
    [pat, project, milestone, categories, phase, issues, position, toast],
  );

  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
}

export function useAudit(): AuditState {
  const v = useContext(AuditContext);
  if (!v) throw new Error('useAudit must be used inside AuditProvider');
  return v;
}
