/**
 * Embeddings for bookmark recommendation.
 *
 * Uses OpenAI's `text-embedding-3-small` routed through OpenRouter
 * (OpenAI-compatible /v1/embeddings endpoint). Native output dim is 1536,
 * matching our vector(1536) schema with no truncation needed.
 *
 * Why OpenRouter: same OPENROUTER_API_KEY already used for chat, with a
 * 1000 RPM cap (after $10 lifetime deposit) — fast enough to finish backfill
 * in minutes, not hours. ~$0.02/M tokens + 5.5% platform fee.
 *
 * Wave 1: exact cosine search over a user's filtered subset (no ANN index yet).
 * Fast for thousands of rows. Add ivfflat/HNSW partial index when corpus
 * size demands it.
 */

import { createHash } from "node:crypto";
import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { and, eq, inArray, isNull, not, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookmarks, bookmarkTags, tags } from "@/db/schema";

export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

// text-embedding-3-small accepts up to 8192 tokens. ~4 chars/token
// => ~32k chars, but we keep the existing 7.5k cap for cost control and
// to stay well under the limit. Composed bookmark inputs rarely exceed this.
const MAX_INPUT_CHARS = 7_500;

function getEmbeddingProvider() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required for embeddings");
  }
  return createOpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
  });
}

type ComposeInput = {
  title: string | null;
  summary: string | null;
  description: string | null;
  domain: string | null;
  tagNames: string[];
};

/** Compose the canonical embedding input for a bookmark. */
export function composeEmbeddingInput(b: ComposeInput): string {
  const parts: string[] = [];
  if (b.title) parts.push(b.title.trim());
  const body = b.summary?.trim() || b.description?.trim();
  if (body) parts.push(body);
  if (b.tagNames.length > 0) parts.push(`Tags: ${b.tagNames.join(", ")}`);
  if (b.domain) parts.push(`Source: ${b.domain}`);
  const joined = parts.join("\n\n");
  return joined.length > MAX_INPUT_CHARS
    ? joined.slice(0, MAX_INPUT_CHARS)
    : joined;
}

export function inputHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Embed a single string. Throws on API failure (caller handles). */
export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("embedText: empty input");
  const { embedding } = await embed({
    model: getEmbeddingProvider().embedding(EMBEDDING_MODEL),
    value: trimmed,
  });
  return embedding;
}

/**
 * Embed multiple strings in a single API request.
 * OpenAI/OpenRouter's /v1/embeddings endpoint counts a multi-input call as
 * ONE request against rate limits — critical for backfill throughput.
 * Caller is responsible for chunking to stay under per-request token limits.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const trimmed = texts.map((t) => t.trim());
  if (trimmed.some((t) => !t)) throw new Error("embedTexts: empty input");
  const { embeddings } = await embedMany({
    model: getEmbeddingProvider().embedding(EMBEDDING_MODEL),
    values: trimmed,
  });
  return embeddings;
}

/** Format a JS number array as Postgres vector literal. */
function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

/**
 * Batch variant of {@link enqueueEmbedding}. Composes inputs for many bookmarks,
 * fetches embeddings in a single :batchEmbedContents request, and writes back.
 *
 * Designed for the backfill script — counts as ONE request against the Gemini
 * RPM/RPD quota regardless of batch size.
 *
 * Skips bookmarks whose composed input matches the stored hash.
 * Returns counts for caller bookkeeping.
 */
export async function enqueueEmbeddingsBatch(
  bookmarkIds: string[],
): Promise<{ embedded: number; skipped: number }> {
  if (bookmarkIds.length === 0) return { embedded: 0, skipped: 0 };

  const rows = await db
    .select({
      id: bookmarks.id,
      title: bookmarks.title,
      summary: bookmarks.summary,
      description: bookmarks.description,
      domain: bookmarks.domain,
      embeddingInputHash: bookmarks.embeddingInputHash,
    })
    .from(bookmarks)
    .where(inArray(bookmarks.id, bookmarkIds));

  const tagRows = await db
    .select({ bookmarkId: bookmarkTags.bookmarkId, name: tags.name })
    .from(bookmarkTags)
    .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
    .where(inArray(bookmarkTags.bookmarkId, bookmarkIds));

  const tagsByBookmark = new Map<string, string[]>();
  for (const t of tagRows) {
    const arr = tagsByBookmark.get(t.bookmarkId) ?? [];
    arr.push(t.name);
    tagsByBookmark.set(t.bookmarkId, arr);
  }

  type Pending = { id: string; input: string; hash: string };
  const pending: Pending[] = [];
  let skipped = 0;

  for (const b of rows) {
    const input = composeEmbeddingInput({
      title: b.title,
      summary: b.summary,
      description: b.description,
      domain: b.domain,
      tagNames: tagsByBookmark.get(b.id) ?? [],
    });
    if (!input) {
      skipped += 1;
      continue;
    }
    const hash = inputHash(input);
    // eslint-disable-next-line security/detect-possible-timing-attacks -- cache-invalidation check
    if (b.embeddingInputHash === hash) {
      skipped += 1;
      continue;
    }
    pending.push({ id: b.id, input, hash });
  }

  if (pending.length === 0) return { embedded: 0, skipped };

  const vectors = await embedTexts(pending.map((p) => p.input));
  if (vectors.length !== pending.length) {
    throw new Error(
      `embedTexts returned ${vectors.length} vectors for ${pending.length} inputs`,
    );
  }

  const now = new Date();
  await Promise.all(
    pending.map((p, i) =>
      db
        .update(bookmarks)
        .set({
          embedding: vectors[i],
          embeddingModel: EMBEDDING_MODEL,
          embeddingInputHash: p.hash,
          embeddedAt: now,
        })
        .where(eq(bookmarks.id, p.id)),
    ),
  );

  return { embedded: pending.length, skipped };
}

/**
 * Generate-or-skip embedding for a bookmark. Idempotent: hashes the composed
 * input, compares to stored hash, skips on match. Safe to call repeatedly.
 *
 * Designed to run inside `after()` from `next/server` so callers don't block
 * on the embedding round-trip. Errors are logged; pass `{ throwOnError: true }`
 * (e.g. from the backfill script) to surface failures for accurate counting.
 */
export async function enqueueEmbedding(
  bookmarkId: string,
  options: { throwOnError?: boolean } = {},
): Promise<void> {
  try {
    const [bookmark] = await db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        summary: bookmarks.summary,
        description: bookmarks.description,
        domain: bookmarks.domain,
        embeddingInputHash: bookmarks.embeddingInputHash,
      })
      .from(bookmarks)
      .where(eq(bookmarks.id, bookmarkId));

    if (!bookmark) {
      console.warn(`[embeddings] bookmark not found: ${bookmarkId}`);
      return;
    }

    const tagRows = await db
      .select({ name: tags.name })
      .from(bookmarkTags)
      .innerJoin(tags, eq(tags.id, bookmarkTags.tagId))
      .where(eq(bookmarkTags.bookmarkId, bookmarkId));

    const input = composeEmbeddingInput({
      title: bookmark.title,
      summary: bookmark.summary,
      description: bookmark.description,
      domain: bookmark.domain,
      tagNames: tagRows.map((t) => t.name),
    });

    if (!input) {
      console.warn(`[embeddings] empty input for ${bookmarkId}, skipping`);
      return;
    }

    const hash = inputHash(input);
    // eslint-disable-next-line security/detect-possible-timing-attacks -- not a secret comparison; cache-invalidation check only
    if (bookmark.embeddingInputHash === hash) {
      return;
    }

    const vector = await embedText(input);

    await db
      .update(bookmarks)
      .set({
        embedding: vector,
        embeddingModel: EMBEDDING_MODEL,
        embeddingInputHash: hash,
        embeddedAt: new Date(),
      })
      .where(eq(bookmarks.id, bookmarkId));
  } catch (err) {
    console.error(
      `[embeddings] enqueueEmbedding failed for ${bookmarkId}:`,
      err instanceof Error ? err.message : err,
    );
    if (options.throwOnError) throw err;
  }
}

/**
 * Find unread/unarchived bookmarks most similar to the seed bookmark, scoped
 * to the seed's user. Returns nearest k by cosine distance, excluding the seed.
 */
export async function findSimilar(
  bookmarkId: string,
  k = 5,
): Promise<Array<{ id: string; score: number }>> {
  const [seed] = await db
    .select({
      id: bookmarks.id,
      userId: bookmarks.userId,
      embedding: bookmarks.embedding,
    })
    .from(bookmarks)
    .where(eq(bookmarks.id, bookmarkId));

  if (!seed?.embedding) return [];

  const literal = toVectorLiteral(seed.embedding);
  const rows = await db.execute<{ id: string; score: number }>(sql`
    SELECT id, 1 - (embedding <=> ${literal}::vector) AS score
    FROM bookmarks
    WHERE user_id = ${seed.userId}
      AND id <> ${seed.id}
      AND is_archived = false
      AND is_read = false
      AND embedding IS NOT NULL
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${k}
  `);
  return rows.map((r) => ({ id: r.id, score: Number(r.score) }));
}

/**
 * Find unread/unarchived bookmarks nearest the centroid (mean) of the given
 * bookmarks' embeddings. The centroid bookmarks themselves are excluded.
 */
export async function findNearestToCentroid(
  userId: string,
  centroidIds: string[],
  k = 5,
): Promise<Array<{ id: string; score: number }>> {
  if (centroidIds.length === 0) return [];

  const seeds = await db
    .select({ embedding: bookmarks.embedding })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        inArray(bookmarks.id, centroidIds),
        not(isNull(bookmarks.embedding)),
      ),
    );

  const vectors = seeds
    .map((s) => s.embedding)
    .filter((v): v is number[] => Array.isArray(v) && v.length > 0);
  if (vectors.length === 0) return [];

  const dim = vectors[0].length;
  const centroid = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) centroid[i] += v[i];
  }
  for (let i = 0; i < dim; i++) centroid[i] /= vectors.length;

  const literal = toVectorLiteral(centroid);
  const excludeArray = `{${centroidIds.join(",")}}`;
  const rows = await db.execute<{ id: string; score: number }>(sql`
    SELECT id, 1 - (embedding <=> ${literal}::vector) AS score
    FROM bookmarks
    WHERE user_id = ${userId}
      AND is_archived = false
      AND is_read = false
      AND embedding IS NOT NULL
      AND id <> ALL(${excludeArray}::uuid[])
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${k}
  `);
  return rows.map((r) => ({ id: r.id, score: Number(r.score) }));
}
