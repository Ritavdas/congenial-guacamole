import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { generateText } from "ai";
import { getModel } from "@/lib/ai";
import { defineContextSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = defineContextSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { word, sentence } = parsed.data;

  try {
    const { text: explanation } = await generateText({
      model: getModel(),
      prompt: `You are a reading assistant. A user is reading an article and wants to understand a specific word in context.

Word: "${word}"
Sentence: "${sentence}"

Explain what "${word}" means in this specific context in 1-2 concise sentences. Be clear and direct. Do not use phrases like "In this context" — just explain the meaning.`,
    });

    return NextResponse.json({ explanation });
  } catch (error) {
    console.error("Define context error:", error);
    return NextResponse.json(
      { error: "Failed to generate context" },
      { status: 500 },
    );
  }
}
