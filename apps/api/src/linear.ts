// Linear GraphQL client. Uses the user's PAT, passed per-request.

import type {
  LinearIssue,
  LinearMilestone,
  LinearProject,
  LinearUser,
  LinearWorkflowStateType,
} from '@linear-audit/shared';

const LINEAR_GRAPHQL = 'https://api.linear.app/graphql';

interface LinearGqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: unknown }>;
}

async function linearGql<T>(pat: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(LINEAR_GRAPHQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: pat,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await res.json()) as LinearGqlResponse<T>;
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Linear API error: ${json.errors.map((e) => e.message).join('; ')}`);
  }
  if (!json.data) throw new Error('Linear API returned no data');
  return json.data;
}

// =============================================================
// Lookups
// =============================================================

export async function whoami(pat: string): Promise<LinearUser> {
  const data = await linearGql<{ viewer: LinearUser & { displayName?: string } }>(
    pat,
    /* GraphQL */ `
      query Viewer {
        viewer {
          id
          name
          displayName
          email
          avatarUrl
        }
      }
    `,
  );
  return data.viewer;
}

export async function listProjects(pat: string): Promise<LinearProject[]> {
  const data = await linearGql<{
    projects: { nodes: Array<LinearProject & { state?: string }> };
  }>(
    pat,
    /* GraphQL */ `
      query Projects {
        projects(first: 100, orderBy: updatedAt) {
          nodes {
            id
            name
            slugId
            description
            url
            state
          }
        }
      }
    `,
  );
  // Filter to non-completed projects client-side (state filter API has changed).
  return data.projects.nodes.filter((p) => p.state !== 'completed');
}

export async function listMilestones(pat: string, projectId: string): Promise<LinearMilestone[]> {
  const data = await linearGql<{
    project: { projectMilestones: { nodes: LinearMilestone[] } };
  }>(
    pat,
    /* GraphQL */ `
      query Milestones($id: String!) {
        project(id: $id) {
          projectMilestones(first: 50) {
            nodes {
              id
              name
              description
              targetDate
            }
          }
        }
      }
    `,
    { id: projectId },
  );
  return data.project.projectMilestones.nodes;
}

// =============================================================
// Issues
// =============================================================

const ISSUE_FIELDS = /* GraphQL */ `
  id
  identifier
  title
  description
  priority
  priorityLabel
  url
  state {
    id
    name
    type
  }
  assignee {
    id
    name
    displayName
    email
    avatarUrl
  }
  labels {
    nodes {
      name
    }
  }
  parent {
    id
    identifier
    title
    url
  }
  createdAt
  updatedAt
`;

interface RawIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  priorityLabel: string;
  url: string;
  state: { id: string; name: string; type: LinearWorkflowStateType };
  assignee: (LinearUser & { displayName: string }) | null;
  labels: { nodes: Array<{ name: string }> };
  parent: { id: string; identifier: string; title: string; url: string } | null;
  createdAt: string;
  updatedAt: string;
}

function shapeIssue(raw: RawIssue, childrenInScope: number): LinearIssue {
  return {
    id: raw.id,
    identifier: raw.identifier,
    title: raw.title,
    description: raw.description,
    priority: raw.priority as LinearIssue['priority'],
    priorityLabel: raw.priorityLabel,
    url: raw.url,
    state: raw.state,
    assignee: raw.assignee,
    labels: raw.labels.nodes.map((n) => n.name),
    parent: raw.parent,
    childrenInScope,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

const OPEN_STATE_TYPES = ['triage', 'backlog', 'unstarted', 'started'];

export async function listOpenIssues(
  pat: string,
  opts: { projectId: string; milestoneId?: string },
): Promise<LinearIssue[]> {
  const filter: Record<string, unknown> = {
    project: { id: { eq: opts.projectId } },
    state: { type: { in: OPEN_STATE_TYPES } },
  };
  if (opts.milestoneId) {
    filter.projectMilestone = { id: { eq: opts.milestoneId } };
  }

  const data = await linearGql<{ issues: { nodes: RawIssue[] } }>(
    pat,
    /* GraphQL */ `
      query OpenIssues($filter: IssueFilter!) {
        issues(filter: $filter, first: 250, orderBy: updatedAt) {
          nodes {
            ${ISSUE_FIELDS}
          }
        }
      }
    `,
    { filter },
  );

  // Build a "how many of my children are also in the open set?" map.
  // We only count children that appear in the same audit scope — that's
  // what the user will actually see swiped, so it's the meaningful count.
  const childCountByParentId = new Map<string, number>();
  for (const raw of data.issues.nodes) {
    if (raw.parent) {
      childCountByParentId.set(
        raw.parent.id,
        (childCountByParentId.get(raw.parent.id) ?? 0) + 1,
      );
    }
  }

  return data.issues.nodes.map((raw) =>
    shapeIssue(raw, childCountByParentId.get(raw.id) ?? 0),
  );
}

// =============================================================
// Mutations
// =============================================================

export async function updateIssueTitle(pat: string, issueId: string, title: string): Promise<void> {
  await linearGql(
    pat,
    /* GraphQL */ `
      mutation UpdateTitle($id: String!, $title: String!) {
        issueUpdate(id: $id, input: { title: $title }) {
          success
        }
      }
    `,
    { id: issueId, title },
  );
}

// Find a workflow state in the issue's team by type, used to set Done/Canceled.
async function findStateIdForIssue(
  pat: string,
  issueId: string,
  stateType: 'completed' | 'canceled',
): Promise<string | null> {
  const data = await linearGql<{
    issue: {
      team: {
        states: { nodes: Array<{ id: string; type: LinearWorkflowStateType }> };
      };
    };
  }>(
    pat,
    /* GraphQL */ `
      query IssueStates($id: String!) {
        issue(id: $id) {
          team {
            states(first: 50) {
              nodes {
                id
                type
              }
            }
          }
        }
      }
    `,
    { id: issueId },
  );
  const match = data.issue.team.states.nodes.find((s) => s.type === stateType);
  return match?.id ?? null;
}

export async function closeIssue(
  pat: string,
  issueId: string,
  as: 'completed' | 'canceled',
  opts?: { duplicateOf?: string },
): Promise<void> {
  const stateId = await findStateIdForIssue(pat, issueId, as);
  if (!stateId) throw new Error(`No ${as} workflow state found on this issue's team`);
  const input: Record<string, unknown> = { stateId };
  // Linear treats `duplicateOf` via the duplicate relation; we accept it but apply via
  // the canceledOf field if supported. In practice many workspaces set state to Canceled
  // and add a "duplicate" comment, which the frontend already does. Skipping the relation
  // mutation here keeps the surface area small.
  await linearGql(
    pat,
    /* GraphQL */ `
      mutation CloseIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
        }
      }
    `,
    { id: issueId, input },
  );
  if (opts?.duplicateOf) {
    // Best-effort comment so the duplicate link is visible even when the relation API isn't used.
    await commentOnIssue(pat, issueId, `Closing as duplicate of ${opts.duplicateOf}.`);
  }
}

export async function commentOnIssue(pat: string, issueId: string, body: string): Promise<void> {
  await linearGql(
    pat,
    /* GraphQL */ `
      mutation Comment($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
        }
      }
    `,
    { issueId, body },
  );
}
