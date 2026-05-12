import type Groq from 'groq-sdk';

export interface StreamGroqResult {
  text: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
  modelUsed: string | null;
}

export async function streamGroqText(
  completion: Awaited<ReturnType<Groq['chat']['completions']['create']>>,
  onToken: (value: string) => void,
): Promise<StreamGroqResult> {
  let text = '';
  let usage: StreamGroqResult['usage'] = null;
  let modelUsed: string | null = null;

  for await (const chunk of completion as AsyncIterable<{
    model?: string;
    choices?: Array<{ delta?: { content?: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
  }>) {
    if (chunk.model && !modelUsed) modelUsed = chunk.model;

    const token = chunk.choices?.[0]?.delta?.content ?? '';
    if (token) {
      text += token;
      onToken(token);
    }

    if (chunk.usage) {
      usage = {
        prompt_tokens: chunk.usage.prompt_tokens,
        completion_tokens: chunk.usage.completion_tokens,
        total_tokens: chunk.usage.total_tokens,
      };
    }
  }

  return { text, usage, modelUsed };
}
