import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { updateBookmarkSummary } from "@/lib/actions";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { bookmarkId, content, title } = await request.json();

  if (!content) {
    return NextResponse.json(
      { error: "No content to summarize" },
      { status: 400 }
    );
  }

  try {
    const { text: summary } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt: `Summarize the following article in 2-3 concise paragraphs. Focus on the key points and main takeaways.

Title: ${title ?? "Unknown"}

Article content:
${content}`,
    });

    await updateBookmarkSummary(bookmarkId, summary);

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("Summarization error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
