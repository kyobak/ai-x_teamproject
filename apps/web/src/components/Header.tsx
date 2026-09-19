"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRealtime } from "@/lib/realtime";
import { setLang, useLang, useT } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

/** 상단 헤더: 뒤로가기, 제목, 한/영 토글, 내 정보(로그인) 아이콘, 실시간 연결 점. */
export function Header({ title, back, dark = false }: { title: string; back?: string; dark?: boolean }) {
  const { connected } = useRealtime();
  const lang = useLang();
  const t = useT();
  const user = useAuth();
  // 스크린리더·번역기가 올바른 언어로 읽도록 <html lang> 을 맞춤
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const chip = dark ? "bg-surface-dark-elevated text-white" : "bg-surface-strong text-ink";
  return (
    <header className={`sticky top-0 z-10 flex h-14 items-center gap-2 px-4 ${dark ? "bg-surface-dark text-white" : "border-b border-hairline bg-canvas/95 text-ink backdrop-blur"}`}>
      {back && <Link href={back} className={`text-2xl leading-none ${dark ? "text-on-dark-soft" : "text-muted"}`} aria-label={t("back")}>‹</Link>}
      <h1 className="flex-1 truncate font-display text-lg">{title}</h1>
      <button onClick={() => setLang(lang === "ko" ? "en" : "ko")} className={`pill px-2.5 py-1 text-[11px] font-semibold ${chip}`} aria-label={t("lang.toggle")}>
        {lang === "ko" ? "EN" : "한"}
      </button>
      <Link href={user ? "/me" : "/login"} className={`pill flex h-7 items-center gap-1 px-2.5 text-[11px] font-semibold ${user ? "bg-primary text-white" : chip}`} aria-label={t("nav.me")}>
        <span aria-hidden>◉</span>{user ? user.nickname : t("login")}
      </Link>
      <span className={`flex items-center gap-1 text-[11px] ${dark ? "text-on-dark-soft" : "text-muted"}`} title={connected ? t("conn.on") : t("conn.off")}>
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-up" : "bg-muted-soft"}`} />
      </span>
    </header>
  );
}
