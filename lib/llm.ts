import type { Schema } from '@google/genai';
import { Type } from '@google/genai';
import { anthropicCall, type AnthropicImage } from './anthropic';
import { geminiCall, type GeminiImage } from './gemini';
import { getSettings, type ModelJob } from './settings';

export type JsonSchema = {
  type: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array';
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
};

export type CallImage = AnthropicImage & GeminiImage;

export type CallArgs = {
  system: string;
  user: string;
  images?: CallImage[];
  schemaName: string;
  schemaDescription: string;
  jsonSchema: JsonSchema;
  cacheSystem?: boolean;
  maxTokens?: number;
};

// JSON Schema (lowercase) -> Gemini SDK Schema (uppercase Type enum).
function toGeminiSchema(j: JsonSchema): Schema {
  const typeMap: Record<JsonSchema['type'], Type> = {
    object: Type.OBJECT,
    string: Type.STRING,
    number: Type.NUMBER,
    integer: Type.INTEGER,
    boolean: Type.BOOLEAN,
    array: Type.ARRAY,
  };
  const out: Schema = { type: typeMap[j.type] };
  if (j.description) out.description = j.description;
  if (j.enum) out.enum = j.enum;
  if (j.properties) {
    out.properties = Object.fromEntries(
      Object.entries(j.properties).map(([k, v]) => [k, toGeminiSchema(v)]),
    );
  }
  if (j.required) out.required = j.required;
  if (j.items) out.items = toGeminiSchema(j.items);
  return out;
}

export async function callModel<T>(job: ModelJob, args: CallArgs): Promise<T> {
  const settings = await getSettings();
  const ref = settings.models[job];
  if (ref.provider === 'anthropic') {
    return anthropicCall<T>({
      model: ref.model,
      system: args.system,
      user: args.user,
      images: args.images,
      schema: {
        name: args.schemaName,
        description: args.schemaDescription,
        input_schema: args.jsonSchema as unknown as Record<string, unknown>,
      },
      cacheSystem: args.cacheSystem,
      maxTokens: args.maxTokens,
    });
  }
  return geminiCall<T>({
    model: ref.model,
    system: args.system,
    user: args.user,
    images: args.images,
    jsonSchema: toGeminiSchema(args.jsonSchema),
    maxTokens: args.maxTokens,
  });
}
