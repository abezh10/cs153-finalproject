import { GoogleGenAI, Type, type Schema } from '@google/genai';

let cached: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  if (!cached) {
    cached = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  }
  return cached;
}

export type GeminiImage = { url: string } | { base64: string; mediaType: string };

export type GeminiCallArgs = {
  model: string;
  system: string;
  user: string;
  images?: GeminiImage[];
  jsonSchema: Schema;
  maxTokens?: number;
};

export async function geminiCall<T>(args: GeminiCallArgs): Promise<T> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  for (const img of args.images ?? []) {
    if ('url' in img) {
      // Gemini SDK doesn't accept URLs directly for arbitrary hosts; fetch and inline.
      const res = await fetch(img.url);
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = res.headers.get('content-type') ?? 'image/jpeg';
      parts.push({ inlineData: { mimeType: mime, data: buf.toString('base64') } });
    } else {
      parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } });
    }
  }
  parts.push({ text: args.user });

  const resp = await gemini().models.generateContent({
    model: args.model,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: args.system,
      responseMimeType: 'application/json',
      responseSchema: args.jsonSchema,
      maxOutputTokens: args.maxTokens ?? 2048,
    },
  });

  const text = resp.text;
  if (!text) throw new Error('Gemini: empty response');
  return JSON.parse(text) as T;
}

// Re-export Type so callers can build typed schemas without importing the SDK.
export { Type as GeminiType };
