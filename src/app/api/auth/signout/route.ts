import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient(cookieStore);
  if (supabase) await supabase.auth.signOut();
  const origin = request.headers.get("origin") || request.headers.get("referer") || "http://localhost:3000";
  return NextResponse.redirect(new URL("/login", origin));
}