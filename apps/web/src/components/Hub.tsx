"use client";
import Link from "next/link";

/** 홈의 분야 카드(큰 타일). 한 줄 요약을 받아 보여줍니다. */
export function HubCard({ href, icon, title, sub, summary }: { href: string; icon: string; title: string; sub: string; summary?: string }) {
  return (
    <Link href={href} className="card flex items-center gap-4 p-5 transition active:bg-surface-soft">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-strong font-display text-xl text-primary" aria-hidden>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base text-ink">{title}</span>
        <span className="block text-xs text-muted">{sub}</span>
        {summary && <span className="mt-1 block truncate text-sm text-body">{summary}</span>}
      </span>
      <span className="text-xl text-muted-soft" aria-hidden>›</span>
    </Link>
  );
}
