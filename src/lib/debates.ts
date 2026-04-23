/**
 * AI debate room — orchestrates a 6-turn structured debate between two
 * bookmarks plus a moderator verdict.
 *
 * `runDebate` is designed to run inside `after()` from `next/server`. It
 * persists incrementally (transcript is updated after every turn) so the
 * /debate/[id] page can poll/refresh and stream the dialogue to the user
 * without us actually streaming HTTP. Per-turn errors are caught and
 * recorded as moderator turns; total failure flips status='failed'.
 */

import { generateText } from "ai";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  bookmarks,
  debates,
  type DebateTurn,
  type DebateStatus,
} from "@/db/schema";
import { getModel } from "@/lib/ai";

const MAX_CONTENT_CHARS = 4000;
const TURN_MAX_TOKENS = 200;
const TURN_TEMPERATURE = 0.7;

type DebateBookmark = {
  id: string;
  title: string | null;
  summary: string | null;
  content: string | null;
  domain: string | null;
};

function bookmarkContext(b: DebateBookmark): string {
  const body =
    b.summary?.trim() ||
    b.content?.trim().slice(0, MAX_CONTENT_CHARS) ||
    "(no body available)";
  return `Title: ${b.title ?? "Untitled"}\nDomain: ${b.domain ?? "unknown"}\nBody: ${body}`;
}

export async function createDebate(
  userId: string,
  bookmarkIds: string[],
): Promise<{ id: string }> {
  if (bookmarkIds.length !== 2) {
    throw new Error("A debate requires exactly 2 bookmarks");
  }
  const [aId, bId] = bookmarkIds;
  if (aId === bId) {
    throw new Error("Pick two different bookmarks");
  }

  const rows = await db
    .select({
      id: bookmarks.id,
      userId: bookmarks.userId,
      summary: bookmarks.summary,
      content: bookmarks.content,
    })
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId));

  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of bookmarkIds) {
    const row = byId.get(id);
    if (!row) {
      throw new Error(`Bookmark ${id} not found or not yours`);
    }
    const hasBody =
      (row.summary && row.summary.trim().length > 0) ||
      (row.content && row.content.trim().length > 0);
    if (!hasBody) {
      throw new Error(
        `Bookmark ${id} has no summary or content — can't debate it yet`,
      );
    }
  }

  const [inserted] = await db
    .insert(debates)
    .values({
      userId,
      bookmarkIds,
      status: "pending",
      transcript: [],
    })
    .returning({ id: debates.id });

  return { id: inserted.id };
}

async function appendTurn(
  debateId: string,
  current: DebateTurn[],
  turn: DebateTurn,
): Promise<DebateTurn[]> {
  const next = [...current, turn];
  await db
    .update(debates)
    .set({ transcript: next })
    .where(eq(debates.id, debateId));
  return next;
}

async function runTurn(
  speaker: "A" | "B",
  bookmark: DebateBookmark,
  opponent: DebateBookmark,
  topic: string,
  transcript: DebateTurn[],
): Promise<string> {
  const history = transcript
    .filter((t) => t.speaker !== "moderator")
    .map(
      (t) =>
        `${t.speaker === speaker ? "YOU" : "OPPONENT"} (${t.speaker}): ${t.text}`,
    )
    .join("\n");

  const turnNumber = transcript.filter((t) => t.speaker === speaker).length + 1;

  const prompt = `You are debating on behalf of one article. Argue ITS position vigorously and concisely. Stay in character — use claims and evidence aligned with your article. Do not concede the opponent's framing.

Debate topic: ${topic}

YOUR ARTICLE (you are speaker ${speaker}):
${bookmarkContext(bookmark)}

OPPONENT'S ARTICLE (speaker ${speaker === "A" ? "B" : "A"}):
${bookmarkContext(opponent)}

Transcript so far:
${history || "(opening statement — no turns yet)"}

Write speaker ${speaker}'s turn ${turnNumber} of 3. Maximum 80 words. No preamble, no "Speaker ${speaker}:" prefix — just the argument.`;

  const { text } = await generateText({
    model: getModel(),
    prompt,
    temperature: TURN_TEMPERATURE,
    maxOutputTokens: TURN_MAX_TOKENS,
  });

  const cleaned = text.trim().replace(/^Speaker [AB]:\s*/i, "");
  if (!cleaned) {
    throw new Error("Empty response from model");
  }
  return cleaned;
}

async function generateTopic(
  a: DebateBookmark,
  b: DebateBookmark,
): Promise<string> {
  const prompt = `Given two articles, write a 5-8 word debate topic that captures their tension. Return only the topic — no quotes, no punctuation at the end.

Article A: ${a.title ?? "Untitled"} — ${a.summary?.slice(0, 300) ?? a.content?.slice(0, 300) ?? ""}

Article B: ${b.title ?? "Untitled"} — ${b.summary?.slice(0, 300) ?? b.content?.slice(0, 300) ?? ""}`;

  const { text } = await generateText({
    model: getModel(),
    prompt,
    temperature: TURN_TEMPERATURE,
    maxOutputTokens: 20,
  });
  return text
    .trim()
    .replace(/^["“”'‘’`]+|["“”'‘’`]+$/g, "")
    .replace(/[.!?]+$/g, "")
    .trim();
}

async function setStatus(
  debateId: string,
  status: DebateStatus,
  completedAt?: Date,
) {
  await db
    .update(debates)
    .set({
      status,
      ...(completedAt ? { completedAt } : {}),
    })
    .where(eq(debates.id, debateId));
}

export async function runDebate(debateId: string): Promise<void> {
  const [debate] = await db
    .select()
    .from(debates)
    .where(eq(debates.id, debateId));

  if (!debate) {
    console.warn(`[debate] not found: ${debateId}`);
    return;
  }
  if (debate.status === "complete") {
    return;
  }
  if (debate.status !== "pending" && debate.status !== "running") {
    return;
  }

  let transcript: DebateTurn[] = debate.transcript ?? [];

  try {
    await setStatus(debateId, "running");

    const [aId, bId] = debate.bookmarkIds;
    const rows = await db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        summary: bookmarks.summary,
        content: bookmarks.content,
        domain: bookmarks.domain,
      })
      .from(bookmarks)
      .where(eq(bookmarks.userId, debate.userId));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a || !b) {
      throw new Error("One or both bookmarks no longer exist");
    }

    let topic = debate.topic;
    if (!topic) {
      try {
        topic = await generateTopic(a, b);
      } catch (err) {
        topic = `${a.title ?? "Article A"} vs ${b.title ?? "Article B"}`;
        console.warn(`[debate] topic gen failed for ${debateId}:`, err);
      }
      await db.update(debates).set({ topic }).where(eq(debates.id, debateId));
    }

    const order: Array<"A" | "B"> = ["A", "B", "A", "B", "A", "B"];
    for (const speaker of order) {
      const me = speaker === "A" ? a : b;
      const opponent = speaker === "A" ? b : a;
      try {
        const text = await runTurn(speaker, me, opponent, topic, transcript);
        transcript = await appendTurn(debateId, transcript, {
          speaker,
          bookmarkId: me.id,
          text,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[debate] turn ${transcript.length + 1} (${speaker}) failed:`,
          msg,
        );
        transcript = await appendTurn(debateId, transcript, {
          speaker: "moderator",
          text: `Speaker ${speaker} dropped this turn (${msg}).`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    try {
      const debateText = transcript
        .filter((t) => t.speaker !== "moderator")
        .map((t) => `${t.speaker}: ${t.text}`)
        .join("\n");
      const { text: verdict } = await generateText({
        model: getModel(),
        prompt: `You are a neutral moderator. Read this debate and synthesize who made the stronger case in 1 sentence. Be specific about the reason.

Topic: ${topic}

${debateText}`,
        temperature: TURN_TEMPERATURE,
        maxOutputTokens: TURN_MAX_TOKENS,
      });
      transcript = await appendTurn(debateId, transcript, {
        speaker: "moderator",
        text: verdict.trim() || "Moderator could not reach a verdict.",
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      transcript = await appendTurn(debateId, transcript, {
        speaker: "moderator",
        text: `Verdict skipped (${msg}).`,
        createdAt: new Date().toISOString(),
      });
    }

    await setStatus(debateId, "complete", new Date());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[debate] runDebate fatal for ${debateId}:`, msg);
    try {
      await appendTurn(debateId, transcript, {
        speaker: "moderator",
        text: `Debate failed: ${msg}`,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // ignore secondary failure
    }
    await setStatus(debateId, "failed", new Date());
  }
}

export async function getDebate(debateId: string, userId: string) {
  const [row] = await db
    .select()
    .from(debates)
    .where(and(eq(debates.id, debateId), eq(debates.userId, userId)));
  return row ?? null;
}

export async function listDebates(userId: string) {
  return db
    .select({
      id: debates.id,
      topic: debates.topic,
      status: debates.status,
      createdAt: debates.createdAt,
    })
    .from(debates)
    .where(eq(debates.userId, userId))
    .orderBy(desc(debates.createdAt))
    .limit(50);
}
