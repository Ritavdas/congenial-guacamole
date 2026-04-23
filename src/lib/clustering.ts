/**
 * Auto topic clusters via k-means over bookmark embeddings.
 *
 * Run on demand by the user from /clusters. Deletes existing clusters for the
 * user, runs Lloyd's algorithm in JS (k-means++ init), then asks the LLM for
 * a short label per cluster. LLM failures fall back to "Cluster N".
 */

import { generateText } from "ai";
import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookmarks, bookmarkTopics, topicClusters } from "@/db/schema";
import { getModel } from "@/lib/ai";

const MAX_BOOKMARKS = 5000;
const MIN_BOOKMARKS = 20;
const MAX_ITERS = 30;
const LABEL_MAX_CHARS = 60;

type Embedded = {
  id: string;
  title: string | null;
  embedding: number[];
};

function squaredDistance(a: number[], b: number[]): number {
  let sum = 0;
  const dim = a.length;
  for (let i = 0; i < dim; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum;
}

function kmeansPlusPlusInit(points: number[][], k: number): number[][] {
  const n = points.length;
  const centroids: number[][] = [];
  const firstIdx = Math.floor(Math.random() * n);
  centroids.push([...points[firstIdx]]);

  const minSqDist = new Array<number>(n).fill(Infinity);

  while (centroids.length < k) {
    const last = centroids[centroids.length - 1];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const d = squaredDistance(points[i], last);
      if (d < minSqDist[i]) minSqDist[i] = d;
      total += minSqDist[i];
    }
    if (total === 0) {
      // All remaining points coincide with chosen centroids; just pick any.
      centroids.push([...points[Math.floor(Math.random() * n)]]);
      continue;
    }
    let r = Math.random() * total;
    let chosen = n - 1;
    for (let i = 0; i < n; i++) {
      r -= minSqDist[i];
      if (r <= 0) {
        chosen = i;
        break;
      }
    }
    centroids.push([...points[chosen]]);
  }

  return centroids;
}

function kmeans(
  points: number[][],
  k: number,
): { assignments: number[]; centroids: number[][] } {
  const n = points.length;
  const dim = points[0].length;
  let centroids = kmeansPlusPlusInit(points, k);
  const assignments = new Array<number>(n).fill(-1);

  for (let iter = 0; iter < MAX_ITERS; iter++) {
    let changed = false;

    for (let i = 0; i < n; i++) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = squaredDistance(points[i], centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = c;
        }
      }
      if (assignments[i] !== bestIdx) {
        assignments[i] = bestIdx;
        changed = true;
      }
    }

    const sums: number[][] = Array.from({ length: k }, () =>
      new Array<number>(dim).fill(0),
    );
    const counts = new Array<number>(k).fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c]++;
      const p = points[i];
      const s = sums[c];
      for (let d = 0; d < dim; d++) s[d] += p[d];
    }

    const next: number[][] = [];
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) {
        // Re-seed empty cluster from a random point to avoid degeneracy.
        next.push([...points[Math.floor(Math.random() * n)]]);
        changed = true;
      } else {
        const mean = new Array<number>(dim);
        for (let d = 0; d < dim; d++) mean[d] = sums[c][d] / counts[c];
        next.push(mean);
      }
    }
    centroids = next;

    if (!changed) break;
  }

  return { assignments, centroids };
}

async function generateLabel(
  titles: string[],
  fallbackIdx: number,
): Promise<string> {
  if (titles.length === 0) return `Cluster ${fallbackIdx + 1}`;
  try {
    const prompt = `Write a 2-4 word topic label for these article titles. Return ONLY the label, no quotes, no period.\n\n${titles.join("\n")}`;
    const { text } = await generateText({
      model: getModel(),
      prompt,
      temperature: 0.3,
      maxOutputTokens: 15,
    });
    let label = text
      .trim()
      .replace(/^["“”'‘’`]+|["“”'‘’`]+$/g, "")
      .replace(/\.$/, "")
      .trim();
    if (!label) return `Cluster ${fallbackIdx + 1}`;
    if (label.length > LABEL_MAX_CHARS) {
      label = label.slice(0, LABEL_MAX_CHARS).trimEnd();
    }
    return label;
  } catch (err) {
    console.error(
      `[clustering] label generation failed for cluster ${fallbackIdx + 1}:`,
      err instanceof Error ? err.message : err,
    );
    return `Cluster ${fallbackIdx + 1}`;
  }
}

export async function rebuildClusters(
  userId: string,
  opts?: { k?: number },
): Promise<{ clusters: number; assignments: number }> {
  // Cascading delete via topic_clusters parent.
  await db.delete(topicClusters).where(eq(topicClusters.userId, userId));

  const rows = (await db
    .select({
      id: bookmarks.id,
      title: bookmarks.title,
      embedding: bookmarks.embedding,
    })
    .from(bookmarks)
    .where(and(eq(bookmarks.userId, userId), isNotNull(bookmarks.embedding)))
    .limit(MAX_BOOKMARKS)) as Embedded[];

  const valid = rows.filter(
    (r) => Array.isArray(r.embedding) && r.embedding.length > 0,
  );
  const N = valid.length;

  if (N < MIN_BOOKMARKS) {
    return { clusters: 0, assignments: 0 };
  }

  const k = opts?.k ?? Math.min(8, Math.max(3, Math.floor(Math.sqrt(N / 2))));

  const points = valid.map((r) => r.embedding);
  const { assignments, centroids } = kmeans(points, k);

  // Group by cluster, pick top 5 closest titles for labelling.
  const clusterMembers: Array<Array<{ idx: number; distSq: number }>> =
    Array.from({ length: k }, () => []);
  for (let i = 0; i < N; i++) {
    const c = assignments[i];
    clusterMembers[c].push({
      idx: i,
      distSq: squaredDistance(points[i], centroids[c]),
    });
  }

  // Generate labels (sequentially — small N, keeps log noise sane).
  const labels: string[] = [];
  for (let c = 0; c < k; c++) {
    if (clusterMembers[c].length === 0) {
      labels.push(`Cluster ${c + 1}`);
      continue;
    }
    const topTitles = [...clusterMembers[c]]
      .sort((a, b) => a.distSq - b.distSq)
      .slice(0, 5)
      .map((m) => valid[m.idx].title)
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0);
    labels.push(await generateLabel(topTitles, c));
  }

  // Insert clusters and capture ids in order.
  const clusterIds: string[] = [];
  let totalAssignments = 0;
  let nonEmptyClusters = 0;

  for (let c = 0; c < k; c++) {
    const members = clusterMembers[c];
    if (members.length === 0) {
      clusterIds.push("");
      continue;
    }
    nonEmptyClusters++;
    const [inserted] = await db
      .insert(topicClusters)
      .values({
        userId,
        label: labels[c],
        centroid: centroids[c],
        memberCount: members.length,
      })
      .returning({ id: topicClusters.id });
    clusterIds.push(inserted.id);

    const assignmentRows = members.map((m) => ({
      bookmarkId: valid[m.idx].id,
      topicClusterId: inserted.id,
      distance: Math.sqrt(m.distSq),
    }));
    // Chunked insert for very large clusters.
    const CHUNK = 500;
    for (let i = 0; i < assignmentRows.length; i += CHUNK) {
      await db
        .insert(bookmarkTopics)
        .values(assignmentRows.slice(i, i + CHUNK));
    }
    totalAssignments += assignmentRows.length;
  }

  return { clusters: nonEmptyClusters, assignments: totalAssignments };
}

export async function getUserClusters(userId: string) {
  return db
    .select({
      id: topicClusters.id,
      label: topicClusters.label,
      memberCount: topicClusters.memberCount,
    })
    .from(topicClusters)
    .where(eq(topicClusters.userId, userId))
    .orderBy(sql`${topicClusters.memberCount} DESC`);
}

export async function getClusterMembers(
  userId: string,
  clusterId: string,
  opts?: { limit?: number },
): Promise<{
  cluster: { id: string; label: string | null; memberCount: number } | null;
  members: Array<{
    id: string;
    title: string | null;
    domain: string | null;
    distance: number;
    isArchived: boolean;
    isRead: boolean;
  }>;
}> {
  const [cluster] = await db
    .select({
      id: topicClusters.id,
      label: topicClusters.label,
      memberCount: topicClusters.memberCount,
    })
    .from(topicClusters)
    .where(
      and(eq(topicClusters.id, clusterId), eq(topicClusters.userId, userId)),
    );

  if (!cluster) return { cluster: null, members: [] };

  const limit = opts?.limit ?? 200;
  const members = await db
    .select({
      id: bookmarks.id,
      title: bookmarks.title,
      domain: bookmarks.domain,
      distance: bookmarkTopics.distance,
      isArchived: bookmarks.isArchived,
      isRead: bookmarks.isRead,
    })
    .from(bookmarkTopics)
    .innerJoin(bookmarks, eq(bookmarks.id, bookmarkTopics.bookmarkId))
    .where(eq(bookmarkTopics.topicClusterId, clusterId))
    .orderBy(sql`${bookmarkTopics.distance} ASC`)
    .limit(limit);

  return { cluster, members };
}
