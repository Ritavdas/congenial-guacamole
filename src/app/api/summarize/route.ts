import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { getModel } from "@/lib/ai";
import { updateBookmarkSummary } from "@/lib/actions";
import { summarizeSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = summarizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { bookmarkId, content, title } = parsed.data;

  try {
    const { text: summary } = await generateText({
      model: getModel(),
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
