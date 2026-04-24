import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  real,
  uuid,
  date,
  primaryKey,
  index,
  customType,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

// pgvector — round-trip number[] <-> Postgres vector literal "[1,2,3]".
// Cast bound params to ::vector explicitly in similarity SQL.
const vector = (dim: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dim})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string): number[] {
      return value.replace(/^\[/, "").replace(/\]$/, "").split(",").map(Number);
    },
  });

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    url: text("url").notNull(),
    title: text("title"),
    description: text("description"),
    ogImage: text("og_image"),
    content: text("content"),
    htmlContent: text("html_content"),
    summary: text("summary"),
    wordCount: integer("word_count"),
    domain: text("domain"),
    isRead: boolean("is_read").default(false).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    searchVector: tsvector("search_vector"),
    embedding: vector(1536)("embedding"),
    embeddingModel: text("embedding_model"),
    embeddingInputHash: text("embedding_input_hash"),
    embeddedAt: timestamp("embedded_at"),
    outcomeChip: text("outcome_chip"),
    outcomeChipModel: text("outcome_chip_model"),
    outcomeChipAt: timestamp("outcome_chip_at", { withTimezone: true }),
    completionScore: real("completion_score"),
    completionScoreAt: timestamp("completion_score_at", { withTimezone: true }),
  },
  (t) => [
    index("bookmarks_user_id_idx").on(t.userId),
    index("bookmarks_user_archived_created_idx").on(
      t.userId,
      t.isArchived,
      t.createdAt.desc(),
    ),
  ],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    color: text("color").default("#6366f1").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("tags_user_id_idx").on(t.userId)],
);

export const bookmarkTags = pgTable(
  "bookmark_tags",
  {
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.bookmarkId, t.tagId] }),
    index("bookmark_tags_tag_id_idx").on(t.tagId),
  ],
);

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    icon: text("icon").default("📁"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("collections_user_id_idx").on(t.userId)],
);

export const bookmarkCollections = pgTable("bookmark_collections", {
  bookmarkId: uuid("bookmark_id")
    .notNull()
    .references(() => bookmarks.id, { onDelete: "cascade" }),
  collectionId: uuid("collection_id")
    .notNull()
    .references(() => collections.id, { onDelete: "cascade" }),
});

export const highlights = pgTable(
  "highlights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    note: text("note"),
    color: text("color").default("#fbbf24").notNull(),
    startOffset: integer("start_offset").notNull(),
    endOffset: integer("end_offset").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("highlights_bookmark_id_idx").on(t.bookmarkId)],
);

export const dailyRecommendations = pgTable("daily_recommendations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  bookmarkId: uuid("bookmark_id")
    .notNull()
    .references(() => bookmarks.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  date: text("date").notNull(),
  isClicked: boolean("is_clicked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const BOOKMARK_EVENT_KINDS = [
  "opened",
  "scroll_25",
  "scroll_50",
  "scroll_75",
  "scroll_100",
  "marked_read",
  "finished_inferred",
] as const;
export type BookmarkEventKind = (typeof BOOKMARK_EVENT_KINDS)[number];

export const bookmarkEvents = pgTable(
  "bookmark_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("bookmark_events_bookmark_id_idx").on(t.bookmarkId),
    index("bookmark_events_user_bookmark_kind_idx").on(
      t.userId,
      t.bookmarkId,
      t.kind,
    ),
  ],
);

export const LOTTERY_PICK_STATUSES = [
  "active",
  "read",
  "expired",
  "skipped",
] as const;
export type LotteryPickStatus = (typeof LOTTERY_PICK_STATUSES)[number];

export const lotteryPicks = pgTable(
  "lottery_picks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    pickedAt: timestamp("picked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => [index("lottery_picks_user_status_idx").on(t.userId, t.status)],
);

export type LotteryPick = typeof lotteryPicks.$inferSelect;
export type NewLotteryPick = typeof lotteryPicks.$inferInsert;

export const dailyExcerpts = pgTable(
  "daily_excerpts",
  {
    userId: text("user_id").notNull(),
    date: date("date").notNull(),
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    excerpt: text("excerpt").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date] }),
    index("daily_excerpts_user_idx").on(t.userId, t.date.desc()),
  ],
);

export type DailyExcerpt = typeof dailyExcerpts.$inferSelect;
export type NewDailyExcerpt = typeof dailyExcerpts.$inferInsert;

export const topicClusters = pgTable(
  "topic_clusters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    label: text("label"),
    centroid: vector(1536)("centroid").notNull(),
    memberCount: integer("member_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("topic_clusters_user_idx").on(t.userId)],
);

export const bookmarkTopics = pgTable(
  "bookmark_topics",
  {
    bookmarkId: uuid("bookmark_id")
      .notNull()
      .references(() => bookmarks.id, { onDelete: "cascade" }),
    topicClusterId: uuid("topic_cluster_id")
      .notNull()
      .references(() => topicClusters.id, { onDelete: "cascade" }),
    distance: real("distance").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.bookmarkId, t.topicClusterId] }),
    index("bookmark_topics_cluster_idx").on(t.topicClusterId),
  ],
);

export type TopicCluster = typeof topicClusters.$inferSelect;
export type NewTopicCluster = typeof topicClusters.$inferInsert;
export type BookmarkTopic = typeof bookmarkTopics.$inferSelect;
export type NewBookmarkTopic = typeof bookmarkTopics.$inferInsert;

export type Bookmark = Omit<
  typeof bookmarks.$inferSelect,
  | "searchVector"
  | "embedding"
  | "embeddingModel"
  | "embeddingInputHash"
  | "embeddedAt"
  | "outcomeChipModel"
  | "outcomeChipAt"
  | "completionScoreAt"
>;
export type NewBookmark = Omit<
  typeof bookmarks.$inferInsert,
  | "searchVector"
  | "embedding"
  | "embeddingModel"
  | "embeddingInputHash"
  | "embeddedAt"
  | "outcomeChipModel"
  | "outcomeChipAt"
  | "completionScoreAt"
>;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type BookmarkWithTags = Bookmark & {
  tags: { id: string; name: string; color: string }[];
};
export type TagWithCount = Tag & { bookmarkCount: number };
export type Collection = typeof collections.$inferSelect;
export type NewCollection = typeof collections.$inferInsert;
export type Highlight = typeof highlights.$inferSelect;
export type NewHighlight = typeof highlights.$inferInsert;
export type DailyRecommendation = typeof dailyRecommendations.$inferSelect;
export type NewDailyRecommendation = typeof dailyRecommendations.$inferInsert;
export type DailyRecommendationWithBookmark = DailyRecommendation & {
  bookmark: Bookmark;
};
