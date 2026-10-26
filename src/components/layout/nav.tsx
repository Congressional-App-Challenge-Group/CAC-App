"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Clock, Compass, Heart, Home, MapPin, SlidersHorizontal } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";

const desktopLinks = [
  { href: "/", label: "Brief", icon: Home },
  { href: "/deadlines", label: "Deadlines", icon: Clock },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/changes", label: "Changes", icon: Activity },
  { href: "/my-area", label: "My area", icon: MapPin },
  { href: "/following", label: "Following", icon: Heart },
];

// Mobile keeps five slots, so it shows the two modes the product is built around
// (what's next, what happened) plus the three personal surfaces. The rest stays
// reachable from the brief and the footer.
const mobileLinks = desktopLinks.filter((link) =>
  ["/", "/deadlines", "/changes", "/my-area", "/following"].includes(link.href),
);

export function Header() {
  const path = usePathname();

  return (
    <>
      <header className="site-header sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="shell flex h-[68px] items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="CivicLens home">
            <span className="brand-mark grid h-9 w-9 place-items-center rounded-xl text-sm font-black shadow-sm">
              CL
            </span>
            <span>
              <span className="block text-lg font-black leading-none tracking-[-0.04em] text-ink">
                CivicLens
              </span>
              <span className="brand-region mt-1 block font-bold uppercase text-subtle">
                Charlotte–Mecklenburg
              </span>
            </span>
          </Link>

          <nav className="desktop-nav flex items-center gap-7 text-sm font-bold" aria-label="Main">
            {desktopLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link"
                data-active={path === link.href}
                aria-current={path === link.href ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/settings"
              title="Personalization settings"
              aria-label="Personalization settings"
              className="settings-pill flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold shadow-sm transition-colors hover:bg-surface-2"
            >
              <SlidersHorizontal size={15} />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </div>
        </div>
      </header>

      <nav
        className="mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
        aria-label="Main"
      >
        {mobileLinks.map((link) => {
          const Icon = link.icon;
          const active = path === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              data-active={active}
              aria-current={active ? "page" : undefined}
              className={cn(
                "mobile-nav-link flex min-h-[66px] flex-col items-center justify-center gap-1 text-[10px] font-extrabold",
              )}
            >
              <span className="grid h-8 w-10 place-items-center rounded-full">
                <Icon size={19} />
              </span>
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
