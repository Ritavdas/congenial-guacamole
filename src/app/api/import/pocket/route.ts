import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { bookmarks, tags, bookmarkTags } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { parsePocketExport, parseAlreadyReadJson } from "@/lib/import-pocket";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const alreadyReadFile = formData.get("alreadyRead") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const content = await file.text();
    const articles = parsePocketExport(content);

    // Parse already-read URLs if provided
    const alreadyReadUrls = new Set<string>();
    if (alreadyReadFile) {
      const arContent = await alreadyReadFile.text();
      for (const url of parseAlreadyReadJson(arContent)) {
        alreadyReadUrls.add(url);
      }
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    const importedIds: string[] = [];

    for (const article of articles) {
      try {
        // Check for duplicate URL for this user
        const existing = await db
          .select({ id: bookmarks.id })
          .from(bookmarks)
          .where(
            and(eq(bookmarks.userId, userId), eq(bookmarks.url, article.url)),
          )
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        let domain: string | null = null;
        try {
          domain = new URL(article.url).hostname.replace(/^www\./, "");
        } catch {
          // invalid URL — store without domain
        }

        const isRead = article.isRead || alreadyReadUrls.has(article.url);

        const insertedId = await db.transaction(async (tx) => {
          const [bookmark] = await tx
            .insert(bookmarks)
            .values({
              userId,
              url: article.url,
              title: article.title,
              domain,
              isRead,
              createdAt: article.timeAdded,
              updatedAt: article.timeAdded,
            })
            .returning({ id: bookmarks.id });

          for (const tagName of article.tags) {
            // Find or create tag for this user
            const existingTags = await tx
              .select({ id: tags.id })
              .from(tags)
              .where(and(eq(tags.userId, userId), eq(tags.name, tagName)))
              .limit(1);

            let tagId: string;
            if (existingTags.length > 0) {
              tagId = existingTags[0].id;
            } else {
              const [newTag] = await tx
                .insert(tags)
                .values({ userId, name: tagName })
                .returning({ id: tags.id });
              tagId = newTag.id;
            }

            await tx.insert(bookmarkTags).values({
              bookmarkId: bookmark.id,
              tagId,
            });
          }

          return bookmark.id;
        });

        importedIds.push(insertedId);
        imported++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      errors,
      total: articles.length,
      importedIds,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to process import file" },
      { status: 500 },
    );
  }
}
