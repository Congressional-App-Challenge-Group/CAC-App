import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getPendingDrafts } from "@/server/decisions";
import { DraftQueue } from "@/features/admin/draft-queue";
import { PageHeader } from "@/components/ui/section";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export const metadata = { title: "Draft review" };

export default async function AdminDraftsPage() {
  const drafts = await getPendingDrafts(100);

  return (
    <div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-extrabold text-civic hover:bg-surface-3"
      >
        <ArrowLeft size={16} />
        Workspace
      </Link>

      <PageHeader
        eyebrow="Editorial"
        title="Plain-language review."
        description="Model-written summaries appear on public pages only after you approve them here. Each draft lists the exact source excerpts it was written from."
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Badge tone="accent">{drafts.length} pending</Badge>
        <p className="text-sm text-muted">
          Rejecting a draft leaves the original record wording in place — nothing is ever removed from
          the public record.
        </p>
      </div>

      <div className="mt-8">
        <DraftQueue drafts={drafts} />
      </div>
    </div>
  );
}
