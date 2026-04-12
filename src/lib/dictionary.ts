/**
 * Dictionary API client — fetches word definitions from the
 * Free Dictionary API (dictionaryapi.dev). No API key required.
 */

export interface DictionaryDefinition {
  definition: string;
  example?: string;
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
}

export interface DictionaryResult {
  word: string;
  phonetic: string | null;
  audioUrl: string | null;
  meanings: DictionaryMeaning[];
}

const API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en";

/**
 * Fetch a word definition from the Free Dictionary API.
 * Returns null if the word is not found (404) or the request was aborted.
 * Throws on other errors (500, network, etc).
 */
export async function fetchDefinition(
  word: string,
  signal?: AbortSignal,
): Promise<DictionaryResult | null> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}/${encodeURIComponent(word)}`, {
      signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return null;
    }
    throw err;
  }

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Dictionary API error: ${response.status}`);
  }

  const data = await response.json();
  const entry = data[0];

  // Extract phonetic text — try the dedicated field first, then phonetics array
  const phoneticText: string | null =
    entry.phonetic ??
    entry.phonetics?.find((p: { text?: string }) => p.text)?.text ??
    null;

  // Extract audio URL from phonetics
  const audioUrl: string | null =
    entry.phonetics?.find((p: { audio?: string }) => p.audio)?.audio ?? null;

  const meanings: DictionaryMeaning[] = (entry.meanings ?? []).map(
    (m: {
      partOfSpeech: string;
      definitions: Array<{ definition: string; example?: string }>;
    }) => ({
      partOfSpeech: m.partOfSpeech,
      definitions: m.definitions.map(
        (d: { definition: string; example?: string }) => ({
          definition: d.definition,
          ...(d.example ? { example: d.example } : {}),
        }),
      ),
    }),
  );

  return {
    word: entry.word,
    phonetic: phoneticText,
    audioUrl,
    meanings,
  };
}
