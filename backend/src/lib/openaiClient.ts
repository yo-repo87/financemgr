import OpenAI from "openai";

// Per-user client: each request builds its own client from that user's decrypted key.
// The key is never cached or logged - it lives only for the duration of the request.
export function buildOpenAiClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}
