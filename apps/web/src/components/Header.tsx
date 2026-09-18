"use client";
import Link from "next/link";
import { useRealtime } from "@/lib/realtime";
import { setLang, useLang, useT } from "@/lib/i18n";

/** 상단 헤더 + 실시간 연결 점 + 한/영 토글. 연결이 끊기면 회색 점으로 "지금 숫자가 최신이 아닐 수 있음" 을 알립니다. */
export function Header({ title, back, dark = false }: { title: string; back?: string; dark?: boolean }) {
  const { connected } = useRealtime();
  const lang = useLang();
  const t = useT();
  return (
    <header className={`sticky top-0 z-10 flex h-14 items-center gap-3 px-4 ${dark ? "bg-surface-dark text-white" : "border-b border-hairline bg-canvas/95 text-ink backdrop-blur"}`}>
      {back && <Link href={back} className={`text-2xl leading-none ${dark ? "text-on-dark-soft" : "text-muted"}`} aria-label="뒤로">‹</Link>}
      <h1 className="flex-1 truncate font-display text-lg">{title}</h1>
      <button onClick={() => setLang(lang === "ko" ? "en" : "ko")} className={`pill px-2.5 py-1 text-[11px] font-semibold ${dark ? "bg-surface-dark-elevated text-white" : "bg-surface-strong text-ink"}`} aria-label="언어 전환">
        {lang === "ko" ? "EN" : "한"}
      </button>
      <span className={`flex items-center gap-1 text-[11px] ${dark ? "text-on-dark-soft" : "text-muted"}`} title={connected ? "실시간 연결됨" : "연결 끊김 (20초마다 재시도)"}>
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-up" : "bg-muted-soft"}`} />
        {connected ? t("live") : t("offline")}
      </span>
    </header>
  );
}
