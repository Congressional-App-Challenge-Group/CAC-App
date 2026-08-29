import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";
import type { cookies } from "next/headers";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Browser client used inside client components (skips auth flows). */
export function createSupabaseBrowserClient() {
  const u = url();
  const k = anonKey();
  if (!u || !k) throw new Error("Supabase environment variables are not configured");
  return createBrowserClient(u, k);
}

/** Server client that preserves the user's session cookies (witch the @auth helpers). */
export async function createSupabaseServerClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const u = url();
  const k = anonKey();
  if (!u || !k) return null;
  return createServerClient(u, k, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (setups: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          setups.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Can be called from a Server Component when creating a client — this is safe to ignore
        }
      },
    },
  });
}

/** Service-role client for privileged server operations (never used in browser code). */
export function createSupabaseServiceClient() {
  const u = url();
  const k = serviceKey();
  if (!u || !k) return null;
  return createServiceClient(u, k);
}