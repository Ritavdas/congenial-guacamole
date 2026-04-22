import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  primaryKey,
  index,
  customType,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
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

export type Bookmark = Omit<typeof bookmarks.$inferSelect, "searchVector">;
export type NewBookmark = Omit<typeof bookmarks.$inferInsert, "searchVector">;
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
