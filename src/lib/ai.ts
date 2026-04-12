// @no-test-required — AI provider config, no testable logic
import { createOpenAI, openai } from "@ai-sdk/openai";

const DEFAULTS = {
  ollama: {
    model: "llama3.2:3b",
    baseURL: "http://localhost:11434/v1",
  },
  openai: {
    model: "gpt-4o-mini",
  },
} as const;

type AIProvider = "ollama" | "openai";

export function getModel() {
  const provider = (process.env.AI_PROVIDER ?? "ollama") as AIProvider;
  const modelName = process.env.AI_MODEL ?? DEFAULTS[provider].model;

  if (provider === "ollama") {
    const ollama = createOpenAI({
      baseURL: process.env.OLLAMA_BASE_URL ?? DEFAULTS.ollama.baseURL,
      apiKey: "ollama", // Ollama doesn't need a real key
    });
    return ollama(modelName);
  }

  return openai(modelName);
}
