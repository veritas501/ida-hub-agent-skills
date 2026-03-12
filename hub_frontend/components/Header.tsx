"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface HeaderProps {
  title: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

function navClass(active: boolean): string {
  return active
    ? "flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-[#2b6cee] px-4 py-2 text-[13px] font-semibold text-white shadow-sm"
    : "flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-[#e9edf4] px-4 py-2 text-[13px] font-semibold text-[#2a3445] hover:bg-[#dde4ef]";
}

export function Header({ title, onRefresh, refreshing = false }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-[#e4e8ef] bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center text-[#2b6cee]">
            <span className="material-symbols-outlined text-[22px]" aria-hidden>
              terminal
            </span>
          </span>
          <h1 className="text-base font-semibold tracking-tight text-[#202a3b] md:text-[20px]">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="flex min-w-[100px] items-center justify-center gap-2 rounded-lg bg-[#e9edf4] px-4 py-2 text-[13px] font-semibold text-[#2a3445] hover:bg-[#dde4ef] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                refresh
              </span>
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
          ) : null}
          <Link href="/config" className={navClass(pathname === "/config")}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              settings
            </span>
            <span>Config</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
