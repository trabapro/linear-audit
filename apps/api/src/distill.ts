// Distill free-text goals → audit categories via Claude.
// Uses the Anthropic SDK with structured JSON output and prompt caching.

import Anthropic from '@anthropic-ai/sdk';
import type { AuditCategory } from '@linear-audit/shared';

const SYSTEM_PROMPT = `You distill an engineer's free-text description of their goals or priorities into a small set of categorization labels they can use to triage Linear tickets.

Constraints:
- Output 3-7 categories. Cover the user's stated goals; do not invent unrelated themes.
- Labels are 1-3 lowercase words, hyphen-separated if multi-word (e.g. "bug", "status-granularity", "filtering").
- Each category gets a fitting emoji and a one-sentence description.
- If the user uses priority shorthand (p0/p1/p2, urgent/important/nice), preserve that signal in the label or description so they can match it back later.
- Do not include presets like "bug" unless the user's goals clearly call for them.
- If the input is vague or too short to extract meaningful categories, return an empty array.`;

// Cached the SDK client; harmless if module-scoped because the API key is process-wide.
let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export interface DistillResult {
  categories: Array<Pick<AuditCategory, 'label' | 'emoji' | 'description'>>;
}

const CATEGORY_PALETTE = [
  '#ec4899', '#06b6d4', '#fbbf24', '#84cc16', '#a78bfa',
  '#f97316', '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
];

function colorForIndex(i: number): string {
  return CATEGORY_PALETTE[i % CATEGORY_PALETTE.length] ?? '#8b5cf6';
}

export async function distillCategories(freeText: string): Promise<AuditCategory[]> {
  const trimmed = freeText.trim();
  if (!trimmed) return [];

  const anthropic = getClient();

  const message = (await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            categories: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  label: { type: 'string' },
                  emoji: { type: 'string' },
                  description: { type: 'string' },
                },
                required: ['label', 'emoji', 'description'],
              },
            },
          },
          required: ['categories'],
        },
      },
    },
    messages: [
      {
        role: 'user',
        content: `Distill these goals into categories:\n\n${trimmed}`,
      },
    ],
  } as Parameters<typeof anthropic.messages.create>[0])) as Anthropic.Message;

  // The text block contains the JSON per our schema.
  const text = message.content.find((b: Anthropic.ContentBlock) => b.type === 'text');
  if (!text || text.type !== 'text') return [];

  let parsed: DistillResult;
  try {
    parsed = JSON.parse(text.text) as DistillResult;
  } catch {
    return [];
  }

  return parsed.categories.map((c, i) => ({
    id: `cat-${Date.now()}-${i}`,
    label: c.label,
    emoji: c.emoji,
    description: c.description,
    color: colorForIndex(i),
    isCustom: true,
  }));
}
