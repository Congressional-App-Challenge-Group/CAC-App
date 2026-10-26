"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, LogIn, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/settings";
  const enabled = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.push(next);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-8">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-civic">
        <Lock size={22} aria-hidden="true" />
      </span>
      <h1 className="mt-5 display-3 text-ink">Editor sign in</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        This private page is only for authorized CivicLens editors. Public personalization is saved
        locally and does not require an account.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            className="mt-2"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            className="mt-2"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
        </div>

        {error ? (
          <p role="alert" className="rounded-[var(--radius)] bg-danger-bg p-3 text-sm font-bold text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={busy || !enabled}>
          <LogIn size={17} aria-hidden="true" />
          {busy ? "Working…" : "Sign in"}
        </Button>

        {!enabled ? (
          <p className="rounded-[var(--radius)] border border-warning/30 bg-warning-bg p-3 text-sm font-bold text-warning">
            Editor access is not configured in this environment.
          </p>
        ) : null}
      </form>

      <div className="mt-5 flex items-center justify-end border-t border-line pt-4">
        <span className="flex items-center gap-1 text-[11px] font-bold text-subtle">
          <ShieldCheck size={13} aria-hidden="true" />
          Authorized editors only
        </span>
      </div>
    </div>
  );
}
