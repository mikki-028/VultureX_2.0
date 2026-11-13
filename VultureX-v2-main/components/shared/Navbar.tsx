"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Logo } from "@/components/shared/Logo";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex items-center justify-between h-12">
          <Link href={isLoggedIn ? "/dashboard" : "/"} className="flex items-center" aria-label="VultureX">
            <Logo size={22} priority />
          </Link>

          <nav role="navigation" aria-label="Main" className="hidden md:flex items-center gap-6">
            <Link href="/explore" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Explore</Link>
            <Link href="/competitions" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Competitions</Link>
            <Link href="/rankings" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Rankings</Link>
            <Link href="/knowledge-hub" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Knowledge Hub</Link>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            <div className="hidden md:flex items-center gap-4">
              {isLoggedIn ? (
                <>
                  <Link href="/dashboard" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Dashboard</Link>
                  <button onClick={() => signOut({ callbackUrl: "/" })} className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">Sign in</Link>
                  <Link href="/signup" className="text-xs font-medium px-3 py-1.5 bg-[var(--text)] text-[var(--bg)] rounded-md hover:opacity-90 transition-opacity">
                    Get started
                  </Link>
                </>
              )}
            </div>

            <button className="md:hidden p-1" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
              {open ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {open && (
          <div className="md:hidden pb-3 pt-2 border-t border-[var(--border)] space-y-2">
            <Link href="/explore" className="block text-xs text-[var(--text-muted)] py-1" onClick={() => setOpen(false)}>Explore</Link>
            <Link href="/competitions" className="block text-xs text-[var(--text-muted)] py-1" onClick={() => setOpen(false)}>Competitions</Link>
            <Link href="/rankings" className="block text-xs text-[var(--text-muted)] py-1" onClick={() => setOpen(false)}>Rankings</Link>
            <Link href="/knowledge-hub" className="block text-xs text-[var(--text-muted)] py-1" onClick={() => setOpen(false)}>Knowledge Hub</Link>
            <div className="pt-2 border-t border-[var(--border)] flex gap-4">
              {isLoggedIn ? (
                <Link href="/dashboard" className="text-xs font-medium" onClick={() => setOpen(false)}>Dashboard</Link>
              ) : (
                <>
                  <Link href="/login" className="text-xs text-[var(--text-muted)]" onClick={() => setOpen(false)}>Sign in</Link>
                  <Link href="/signup" className="text-xs font-medium" onClick={() => setOpen(false)}>Get started</Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
