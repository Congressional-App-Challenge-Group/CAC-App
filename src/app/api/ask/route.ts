import { NextResponse } from "next/server";
import { assistantService } from "@/server/assistant";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { question?: unknown; decisionId?: unknown; decisionSlug?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ text: "I could not read that request.", citations: [] }, { status: 400 });
  }
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const decisionId =
    (typeof body?.decisionId === "string" && body.decisionId) ||
    (typeof body?.decisionSlug === "string" && body.decisionSlug) ||
    "";
  if (!question) {
    return NextResponse.json({ text: "Ask a question about a tracked decision.", citations: [] }, { status: 400 });
  }
  const answer = await assistantService.answerQuestion({ question, decisionId: decisionId || undefined });
  return NextResponse.json(answer);
}