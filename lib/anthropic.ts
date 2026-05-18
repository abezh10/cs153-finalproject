import Anthropic from '@anthropic-ai/sdk';

let cached: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!cached) cached = new Anthropic();
  return cached;
}

export type AnthropicImage = { url: string } | { base64: string; mediaType: string };

export type AnthropicCallArgs = {
  model: string;
  system: string;
  user: string;
  images?: AnthropicImage[];
  schema: { name: string; description: string; input_schema: Record<string, unknown> };
  cacheSystem?: boolean;
  maxTokens?: number;
};

export async function anthropicCall<T>(args: AnthropicCallArgs): Promise<T> {
  const userContent: Anthropic.Messages.ContentBlockParam[] = [];
  for (const img of args.images ?? []) {
    if ('url' in img) {
      userContent.push({ type: 'image', source: { type: 'url', url: img.url } });
    } else {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType as Anthropic.Messages.Base64ImageSource['media_type'], data: img.base64 },
      });
    }
  }
  userContent.push({ type: 'text', text: args.user });

  const systemBlock: Anthropic.Messages.TextBlockParam = {
    type: 'text',
    text: args.system,
    ...(args.cacheSystem ? { cache_control: { type: 'ephemeral' } } : {}),
  };

  const resp = await anthropic().messages.create({
    model: args.model,
    max_tokens: args.maxTokens ?? 2048,
    system: [systemBlock],
    tools: [
      {
        name: args.schema.name,
        description: args.schema.description,
        input_schema: args.schema.input_schema as Anthropic.Messages.Tool.InputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: args.schema.name },
    messages: [{ role: 'user', content: userContent }],
  });

  const toolUse = resp.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Anthropic: no tool_use block in response');
  }
  return toolUse.input as T;
}
