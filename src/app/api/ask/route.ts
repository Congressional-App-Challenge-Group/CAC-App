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
  // Cross-record questions flow through the same service; `decisionId` narrows
  // to one record when the UI supplies one, preserving the existing flow.
  const answer = decisionId
    ? await assistantService.answerQuestion({ question, decisionId })
    : await assistantService.answerAcrossRecords({ question });
  return NextResponse.json(answer);
}