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
  const next = searchParams.get("next") || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setError(
            "Check your inbox — we sent a confirmation link to complete sign-up, then sign in.",
          );
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      // Middleware refreshes the session cookie; then head to the workspace.
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
        Access is limited to CivicLens editors. Your session is secured with Supabase authentication.
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
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
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

        <Button type="submit" className="w-full" disabled={busy}>
          <LogIn size={17} aria-hidden="true" />
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create editor account"}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <button
          type="button"
          className="text-sm font-bold text-civic hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Create an editor account instead" : "Back to sign in"}
        </button>
        <span className="flex items-center gap-1 text-[11px] font-bold text-subtle">
          <ShieldCheck size={13} aria-hidden="true" />
          Role-gated
        </span>
      </div>
    </div>
  );
}
