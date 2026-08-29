"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, LogIn, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setError("Check your inbox — we sent a confirmation link to complete sign-up, then sign in.");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      // Middleware updates cookies; navigate to the requested admin page.
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell max-w-md py-16 md:py-24">
      <div className="card p-8">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#102a26] text-emerald-300"><Lock size={22} /></span>
        <h1 className="mt-5 text-3xl font-black tracking-[-.05em]">Editor sign in</h1>
        <p className="mt-2 text-sm leading-6 text-[#5b6f6a]">
          Access is limited to CivicLens editors. Your session is secured with Supabase authentication.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="font-bold">Email</span>
            <input className="field mt-2" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block">
            <span className="font-bold">Password</span>
            <input className="field mt-2" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </label>
          {error && <p role="alert" className="rounded-xl bg-red-100 p-3 text-sm font-bold text-red-800">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}><LogIn size={17} />{busy ? "Working…" : mode === "signin" ? "Sign in" : "Create editor account"}</button>
        </form>
        <div className="mt-5 flex items-center justify-between border-t border-[#e2ebe7] pt-4">
          <button className="text-sm font-bold text-[#08785f] hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "Create an editor account instead" : "Back to sign in"}
          </button>
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#6b7d78]"><ShieldCheck size={13} /> Role-gated</span>
        </div>
      </div>
    </div>
  );
}