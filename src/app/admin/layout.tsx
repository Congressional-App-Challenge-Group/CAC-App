import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentUser();
  if (!current) redirect("/login?next=/admin");

  if (!current.role) {
    return (
      <div className="shell py-16">
        <div className="card mx-auto max-w-md p-8 text-center">
          <ShieldCheck className="mx-auto text-civic" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-black text-ink">Editor access only</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Your account doesn&apos;t have an editorial role yet. Ask a CivicLens admin to add you to the
            editors table before using the workspace.
          </p>
          <Link className="btn btn-primary mt-6" href="/">
            Back to the public site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="shell py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="eyebrow">Editorial workspace</p>
          <p className="display-3 text-ink">CivicLens Admin</p>
        </div>

        <nav className="flex gap-4 text-sm font-bold text-ink-soft" aria-label="Workspace">
          <Link href="/admin" className="hover:text-civic">
            Overview
          </Link>
          <Link href="/admin/drafts" className="hover:text-civic">
            Draft review
          </Link>
          <Link href="/admin/decisions" className="hover:text-civic">
            Decisions
          </Link>
          <Link href="/" className="hover:text-civic">
            Public site
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs font-extrabold text-civic">
            <ShieldCheck size={14} aria-hidden="true" />
            {current.email} · {current.role}
          </span>
          <form action="/api/auth/signout" method="post">
            <button className="flex items-center gap-1.5 rounded-lg border border-line-strong px-3 py-1.5 text-xs font-extrabold text-ink-soft transition-colors hover:bg-surface-2">
              <LogOut size={13} />
              Sign out
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
