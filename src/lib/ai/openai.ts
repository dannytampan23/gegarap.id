import { logEvent } from '@/lib/logger';

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';

export const DEFAULT_OPENAI_MODEL = 'gpt-5.6-sol';

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

interface StructuredResponseInput {
  system: string;
  input: Array<{ role: 'user' | 'assistant'; content: string }>;
  schemaName: string;
  schemaDescription: string;
  schema: Record<string, unknown>;
  model?: string;
  maxOutputTokens?: number;
}

interface OpenAITextBlock {
  type?: string;
  text?: string;
}

interface OpenAIResponse {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: OpenAITextBlock[];
  }>;
  status?: string;
  error?: { message?: string };
}

function baseUrl(): string {
  return (process.env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL).replace(/\/$/, '');
}

function extractText(response: OpenAIResponse): string {
  if (typeof response.output_text === 'string') return response.output_text;

  for (const item of response.output ?? []) {
    for (const block of item.content ?? []) {
      if (
        (block.type === 'output_text' || block.type === 'text') &&
        typeof block.text === 'string'
      ) {
        return block.text;
      }
    }
  }

  throw new Error('OpenAI response did not contain text output');
}

export async function createStructuredResponse<T>(
  params: StructuredResponseInput
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const res = await fetch(`${baseUrl()}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model ?? process.env.GEGARAP_AI_MODEL ?? DEFAULT_OPENAI_MODEL,
      instructions: params.system,
      input: params.input,
      max_output_tokens: params.maxOutputTokens,
      text: {
        format: {
          type: 'json_schema',
          name: params.schemaName,
          description: params.schemaDescription,
          schema: params.schema,
          strict: true,
        },
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });

  const body = (await res.json().catch(() => null)) as OpenAIResponse | null;
  if (!res.ok) {
    const message = body?.error?.message ?? `OpenAI request failed with HTTP ${res.status}`;
    logEvent('openai.responses.failed', { status: res.status, message }, 'warn');
    throw new Error(message);
  }

  const text = extractText(body ?? {});
  return JSON.parse(text) as T;
}
