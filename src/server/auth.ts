import "server-only";
import { cookies } from "next/headers";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase";

export type CurrentUser = { id: string; email: string; role: "editor" | "admin" | null };

/** Read the signed-in user and their editorial role (if any). Safe offline. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient(cookieStore);
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  let role: CurrentUser["role"] = null;
  const service = createSupabaseServiceClient();
  if (service) {
    // The editors table is RLS-protected so we read it with the service role.
    const { data: editor } = await service
      .from("editors")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (editor) role = editor.role as CurrentUser["role"];
  }
  return { id: user.id, email: user.email ?? "", role };
}

/** Service-role helper to grant or revoke editorial access. */
export async function setEditorRole(userId: string, active: boolean, role: "editor" | "admin" = "editor") {
  const service = createSupabaseServiceClient();
  if (!service) return { ok: false, reason: "Service role is not configured." };
  if (active) {
    const { error } = await service.from("editors").upsert({ user_id: userId, role }, { onConflict: "user_id" });
    return { ok: !error, reason: error?.message ?? null };
  }
  const { error } = await service.from("editors").delete().eq("user_id", userId);
  return { ok: !error, reason: error?.message ?? null };
}