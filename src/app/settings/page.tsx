"use client";

import Link from "next/link";
import { HardDrive, Palette, ShieldCheck, SlidersHorizontal } from "lucide-react";

export default function Settings() {
  return (
    <div className="shell max-w-3xl py-10 md:py-14">
      <p className="eyebrow">Your CivicLens</p>
      <h1 className="mt-3 text-4xl font-black tracking-[-.055em] md:text-5xl">Settings</h1>
      <div className="mt-8 grid gap-4">
        <Setting
          icon={<HardDrive />}
          title="Saved on this device"
          text="Your ZIP, roles, interests, and followed decisions are stored in this browser. No account is required, and these choices do not sync to other devices."
        />
        <Setting
          icon={<SlidersHorizontal />}
          title="Personalization"
          text="Update the ZIP code, roles, and interests used for recommendations."
          action={<Link href="/onboarding" className="btn btn-primary">Edit preferences</Link>}
        />
        <Setting icon={<Palette />} title="Appearance" text="Use the moon or sun button in the navigation to switch themes. Your choice is remembered." />
        <Setting icon={<ShieldCheck />} title="Privacy" text="CivicLens uses your ZIP and interests to personalize public information. Precise location is optional." />
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
