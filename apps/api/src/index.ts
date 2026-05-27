// Hono backend. Proxies Linear GraphQL using the PAT the client supplies in `X-Linear-Pat`.
// In production, also serves the built frontend from apps/web/dist.

import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/bun';
import {
  buildTitleWithCategories,
  parseCategoriesFromTitle,
  type ActionResult,
  type AuditCategory,
  type AuditDecision,
} from '@linear-audit/shared';
import {
  closeIssue,
  commentOnIssue,
  listMilestones,
  listOpenIssues,
  listProjects,
  updateIssueTitle,
  whoami,
} from './linear';

const app = new Hono();

app.use('*', logger());
app.use('/api/*', cors({ origin: '*', allowHeaders: ['Content-Type', 'X-Linear-Pat'] }));

// Health endpoint for Railway.
app.get('/health', (c) => c.json({ ok: true }));

function getPat(c: Context): string {
  const pat = c.req.header('X-Linear-Pat');
  if (!pat) throw new Error('Missing X-Linear-Pat header');
  return pat;
}

// -----------------------------------------------------------------
// Linear read endpoints
// -----------------------------------------------------------------

app.get('/api/whoami', async (c) => {
  try {
    const user = await whoami(getPat(c));
    return c.json(user);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 401);
  }
});

app.get('/api/projects', async (c) => {
  try {
    const projects = await listProjects(getPat(c));
    return c.json(projects);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

app.get('/api/projects/:projectId/milestones', async (c) => {
  try {
    const milestones = await listMilestones(getPat(c), c.req.param('projectId'));
    return c.json(milestones);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

app.get('/api/issues', async (c) => {
  try {
    const projectId = c.req.query('projectId');
    if (!projectId) return c.json({ error: 'projectId is required' }, 400);
    const milestoneId = c.req.query('milestoneId') || undefined;
    const issues = await listOpenIssues(getPat(c), { projectId, milestoneId });
    return c.json(issues);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// -----------------------------------------------------------------
// Action endpoint — execute a single decision live.
// -----------------------------------------------------------------

interface DecisionRequest {
  decision: AuditDecision;
  // The category list the client is using; needed to translate categoryIds → labels for title prefix.
  categories: AuditCategory[];
  // Current title at decision time (so the backend doesn't need to round-trip Linear first).
  currentTitle: string;
}

app.post('/api/decisions', async (c) => {
  let body: DecisionRequest;
  try {
    body = (await c.req.json()) as DecisionRequest;
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { decision, categories, currentTitle } = body;
  const performed: string[] = [];
  const pat = getPat(c);

  try {
    if (decision.action === 'skip') {
      return c.json<ActionResult>({
        ok: true,
        issueId: decision.issueId,
        identifier: decision.identifier,
        performed: ['skipped'],
      });
    }

    if (decision.action === 'close' || decision.action === 'cancel') {
      const stateType = decision.action === 'close' ? 'completed' : 'canceled';
      await closeIssue(pat, decision.issueId, stateType, { duplicateOf: decision.duplicateOf });
      performed.push(`Set state to ${stateType === 'completed' ? 'Done' : 'Canceled'}`);
      if (decision.note) {
        await commentOnIssue(pat, decision.issueId, decision.note);
        performed.push('Added comment');
      }
    }

    if (decision.action === 'pending') {
      const labels = (decision.categoryIds ?? [])
        .map((id) => categories.find((c) => c.id === id)?.label)
        .filter((l): l is string => !!l);

      if (labels.length > 0) {
        // Merge with any existing categories already in the title.
        const existing = parseCategoriesFromTitle(currentTitle).categories;
        const merged = Array.from(new Set([...existing, ...labels]));
        const newTitle = buildTitleWithCategories(currentTitle, merged);
        if (newTitle !== currentTitle) {
          await updateIssueTitle(pat, decision.issueId, newTitle);
          performed.push(`Title → ${newTitle}`);
        }
      }

      if (decision.note) {
        await commentOnIssue(pat, decision.issueId, decision.note);
        performed.push('Added comment');
      }
    }

    return c.json<ActionResult>({
      ok: true,
      issueId: decision.issueId,
      identifier: decision.identifier,
      performed,
    });
  } catch (err) {
    return c.json<ActionResult>(
      {
        ok: false,
        issueId: decision.issueId,
        identifier: decision.identifier,
        performed,
        error: (err as Error).message,
      },
      400,
    );
  }
});

// -----------------------------------------------------------------
// Static frontend (production only).
// -----------------------------------------------------------------

if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: '../web/dist' }));
  app.use('*', serveStatic({ path: '../web/dist/index.html' }));
}

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
console.log(`linear-audit api listening on :${port}`);

export default {
  port,
  fetch: app.fetch,
};
