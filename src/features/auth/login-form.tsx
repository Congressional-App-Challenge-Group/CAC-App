"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Lock, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { useSession } from "@/components/session-provider";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { enabled, loading } = useSession();
  const next = searchParams.get("next") || "/settings";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice(
            "Check your inbox — we sent a confirmation link to complete sign-up, then sign in.",
          );
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
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
      <h1 className="mt-5 display-3 text-ink">{mode === "signin" ? "Welcome back" : "Create your CivicLens account"}</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        {mode === "signin"
          ? "Sign in to sync your preferences, places, and followed decisions across devices."
          : "A free account keeps your CivicLens personal without changing what is public."}
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

        {notice ? (
          <p role="status" className="flex items-start gap-2 rounded-[var(--radius)] border border-success/30 bg-success-bg p-3 text-sm font-bold text-success">
            <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
            {notice}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={busy || (!loading && !enabled)}>
          {mode === "signin" ? <LogIn size={17} aria-hidden="true" /> : <UserPlus size={17} aria-hidden="true" />}
          {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>

        {!loading && !enabled ? (
          <p className="rounded-[var(--radius)] border border-warning/30 bg-warning-bg p-3 text-sm font-bold text-warning">
            Account sync is not connected in this environment yet. Guest personalization and follows still work on this device.
          </p>
        ) : null}
      </form>

      <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
        <button
          type="button"
          className="text-sm font-bold text-civic hover:underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        <span className="flex items-center gap-1 text-[11px] font-bold text-subtle">
          <ShieldCheck size={13} aria-hidden="true" />
          Secure account
        </span>
      </div>
    </div>
  );
}
