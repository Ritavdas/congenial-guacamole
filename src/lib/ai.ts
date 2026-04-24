import { createOpenAI, openai } from "@ai-sdk/openai";

const AI_PROVIDERS = ["ollama", "openai", "openrouter"] as const;
type AIProvider = (typeof AI_PROVIDERS)[number];

const DEFAULTS = {
  ollama: {
    model: "llama3.2:3b",
    baseURL: "http://localhost:11434/v1",
  },
  openai: {
    model: "gpt-4o-mini",
  },
  openrouter: {
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    baseURL: "https://openrouter.ai/api/v1",
  },
} as const;

const DEFAULT_PROVIDER: AIProvider = "openrouter";

type AIModelConfig = {
  provider: AIProvider;
  modelName: string;
  baseURL: string;
};

function getProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER;

  return AI_PROVIDERS.includes(provider as AIProvider)
    ? (provider as AIProvider)
    : DEFAULT_PROVIDER;
}

function getRequiredEnv(name: "OPENROUTER_API_KEY") {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for the OpenRouter provider`);
  }

  return value;
}

export function getModelConfig(): AIModelConfig {
  const provider = getProvider();
  const modelName = process.env.AI_MODEL ?? DEFAULTS[provider].model;

  if (provider === "ollama") {
    return {
      provider,
      modelName,
      baseURL: process.env.OLLAMA_BASE_URL ?? DEFAULTS.ollama.baseURL,
    };
  }

  if (provider === "openrouter") {
    return {
      provider,
      modelName,
      baseURL: DEFAULTS.openrouter.baseURL,
    };
  }

  return {
    provider,
    modelName,
    baseURL: "https://api.openai.com/v1",
  };
}

export function getModel() {
  const { provider, modelName, baseURL } = getModelConfig();

  if (provider === "ollama") {
    const ollama = createOpenAI({
      baseURL,
      apiKey: "ollama", // Ollama doesn't need a real key
    });
    return ollama(modelName);
  }

  if (provider === "openrouter") {
    const openrouter = createOpenAI({
      baseURL,
      apiKey: getRequiredEnv("OPENROUTER_API_KEY"),
    });
    return openrouter(modelName);
  }

  return openai(modelName);
}
