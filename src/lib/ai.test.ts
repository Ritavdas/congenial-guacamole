import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateOpenAI = vi.fn();
const mockOpenAI = vi.fn();

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: mockCreateOpenAI,
  openai: mockOpenAI,
}));

const originalEnv = process.env;

describe("getModel", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.AI_PROVIDER;
    delete process.env.AI_MODEL;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OPENROUTER_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses OpenRouter by default", async () => {
    process.env.OPENROUTER_API_KEY = "openrouter-key";

    const openrouterModel = { id: "openrouter-model" };
    const openrouterClient = vi.fn().mockReturnValue(openrouterModel);
    mockCreateOpenAI.mockReturnValue(openrouterClient);

    const { getModel } = await import("@/lib/ai");

    expect(getModel()).toBe(openrouterModel);
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: "openrouter-key",
    });
    expect(openrouterClient).toHaveBeenCalledWith(
      "deepseek/deepseek-chat-v3-0324",
    );
    expect(mockOpenAI).not.toHaveBeenCalled();
  });

  it("throws when the OpenRouter key is missing", async () => {
    const { getModel } = await import("@/lib/ai");

    expect(() => getModel()).toThrow(
      "OPENROUTER_API_KEY is required for the OpenRouter provider",
    );
    expect(mockCreateOpenAI).not.toHaveBeenCalled();
  });

  it("uses Ollama when configured", async () => {
    process.env.AI_PROVIDER = "ollama";
    process.env.AI_MODEL = "llama3.2:1b";

    const ollamaModel = { id: "ollama-model" };
    const ollamaClient = vi.fn().mockReturnValue(ollamaModel);
    mockCreateOpenAI.mockReturnValue(ollamaClient);

    const { getModel } = await import("@/lib/ai");

    expect(getModel()).toBe(ollamaModel);
    expect(mockCreateOpenAI).toHaveBeenCalledWith({
      baseURL: "http://localhost:11434/v1",
      apiKey: "ollama",
    });
    expect(ollamaClient).toHaveBeenCalledWith("llama3.2:1b");
  });

  it("uses OpenAI when configured", async () => {
    process.env.AI_PROVIDER = "openai";
    process.env.AI_MODEL = "gpt-4.1-mini";

    const openAIModel = { id: "openai-model" };
    mockOpenAI.mockReturnValue(openAIModel);

    const { getModel } = await import("@/lib/ai");

    expect(getModel()).toBe(openAIModel);
    expect(mockOpenAI).toHaveBeenCalledWith("gpt-4.1-mini");
    expect(mockCreateOpenAI).not.toHaveBeenCalled();
  });
});
