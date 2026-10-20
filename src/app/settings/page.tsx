"use client";

import Link from "next/link";
import { Cloud, HardDrive, LogIn, LogOut, Palette, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { usePreferences } from "@/features/preferences/preferences";

export default function Settings() {
  const { user, enabled, loading } = useSession();
  const { source } = usePreferences();

  return (
    <div className="shell max-w-3xl py-10 md:py-14">
      <p className="eyebrow">Your CivicLens</p>
      <h1 className="mt-3 text-4xl font-black tracking-[-.055em] md:text-5xl">Account &amp; settings</h1>
      <div className="mt-8 grid gap-4">
        <Setting
          icon={user ? <Cloud /> : <UserRound />}
          title={user ? "Signed in" : "Your account"}
          text={user
            ? `${user.email ?? "Your account"} · Preferences and follows are synced to your account.`
            : "Create a free account to carry your ZIP, interests, and followed decisions across devices."}
          action={user ? (
            <form action="/api/auth/signout" method="post">
              <button className="btn btn-secondary" type="submit"><LogOut size={17} /> Sign out</button>
            </form>
          ) : (
            <Link href="/login" className="btn btn-primary"><LogIn size={17} /> Sign in or sign up</Link>
          )}
        />
        <Setting
          icon={<SlidersHorizontal />}
          title="Personalization"
          text="Update the ZIP code, roles, and interests used for recommendations."
          action={<Link href="/onboarding" className="btn btn-primary">Edit preferences</Link>}
        />
        <Setting
          icon={source === "account" ? <Cloud /> : <HardDrive />}
          title={source === "account" ? "Account sync" : "Guest mode"}
          text={source === "account"
            ? "Your saved choices are connected to your account and also cached on this device."
            : "Your preferences and followed decisions stay safely on this device until you sign in."}
        />
        <Setting icon={<Palette />} title="Appearance" text="Use the moon or sun button in the navigation to switch themes. Your choice is remembered." />
        <Setting icon={<ShieldCheck />} title="Privacy" text="CivicLens uses your ZIP and interests only to filter public information. Precise location is optional." />
        {!enabled && !loading ? (
          <p className="rounded-lg border border-warning/30 bg-warning-bg p-4 text-sm font-bold text-warning">
            Account sync is unavailable in this environment, but guest personalization still works.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Setting({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint text-civic">{icon}</span>
      <div className="flex-1"><h2 className="text-lg font-black">{title}</h2><p className="mt-1 text-sm leading-6 text-muted">{text}</p></div>
      {action}
    </section>
  );
}
