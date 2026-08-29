"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Decision } from "@/types";
import { statuses } from "@/types";

type Status = "idle" | "saving" | "saved" | "error";

export function DecisionForm({ decision }: { decision?: Decision }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setStatus("saving");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const title = String(data.title ?? "");
    const summary = String(data.summary ?? "");
    if (title.length < 8 || summary.length < 20) {
      setStatus("idle");
      return setMessage("Add a title of at least 8 characters and a summary of at least 20 characters.");
    }
    try {
      const response = await fetch("/api/admin/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: decision?.id,
          title,
          summary,
          topic: data.topic,
          organization: data.organization,
          status: data.status,
          whyItMatters: data.whyItMatters,
          sourceUrl: data.source,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setStatus("error");
        return setMessage(body.error ?? "Could not save. Are you signed in with an editor role?");
      }
      setStatus("saved");
      setMessage(decision ? "Changes published to the verified record." : "Decision created and published.");
      router.refresh();
      if (!decision) setTimeout(() => router.push("/admin/decisions"), 900);
    } catch {
      setStatus("error");
      setMessage("There was a network problem. Please try again.");
    }
  }

  return (
    <form onSubmit={submit} className="card mt-6 space-y-5 p-6">
      <Field label="Decision title" name="title" value={decision?.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="font-bold">Organization</span>
          <select className="field mt-2" name="organization" defaultValue={decision?.organization}>
            <option value="charlotte">Charlotte</option>
            <option value="mecklenburg-county">Mecklenburg County</option>
            <option value="cms">CMS</option>
          </select>
        </label>
        <label>
          <span className="font-bold">Status</span>
          <select className="field mt-2" name="status" defaultValue={decision?.status}>
            {statuses.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>
      <Field label="Topic" name="topic" value={decision?.topic} />
      <label className="block">
        <span className="font-bold">Plain-language summary</span>
        <textarea className="field mt-2 min-h-28" name="summary" defaultValue={decision?.summary} />
      </label>
      <label className="block">
        <span className="font-bold">Why it matters</span>
        <textarea className="field mt-2 min-h-24" name="whyItMatters" defaultValue={decision?.whyItMatters} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Affected ZIP codes" name="zips" value={decision?.affectedZipCodes.join(", ")} />
        <Field label="Affected roles" name="roles" value={decision?.affectedRoles.join(", ")} />
      </div>
      <label className="block">
        <span className="font-bold">Official source URL</span>
        <input className="field mt-2" name="source" type="url" defaultValue={decision?.sources[0]?.url} />
      </label>
      <div className="rounded-xl bg-mint p-4 text-sm">
        <b>Editor write access:</b> Saving publishes directly to the verified record and is gated by your authenticated editor role.
      </div>
      {message && (
        <p role="status" className={`font-bold ${status === "error" ? "text-red-700" : "text-civic"}`}>
          {message}
        </p>
      )}
      <button className="btn btn-primary" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : decision ? "Publish changes" : "Create decision"}
      </button>
    </form>
  );
}

function Field({ label, name, value }: { label: string; name: string; value?: string }) {
  return (
    <label className="block">
      <span className="font-bold">{label}</span>
      <input className="field mt-2" name={name} defaultValue={value} />
    </label>
  );
}