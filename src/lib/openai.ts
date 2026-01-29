import OpenAI from "openai";

function createOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const globalForOpenAI = globalThis as unknown as { openai: OpenAI };
export const openai = globalForOpenAI.openai || createOpenAIClient();

if (process.env.NODE_ENV !== "production") {
  globalForOpenAI.openai = openai;
}
