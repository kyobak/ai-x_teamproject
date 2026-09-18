"use client";
import Link from "next/link";
import { useRealtime } from "@/lib/realtime";

/** 페이지 상단 헤더 + 실시간 연결 상태 점. 연결이 끊기면 회색으로 바뀌어 "지금 보이는 숫자가 최신이 아닐 수 있음" 을 알립니다. */
export function Header({ title, back }: { title: string; back?: string }) {
  const { connected } = useRealtime();
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
      {back && <Link href={back} className="text-xl text-slate-500" aria-label="뒤로">‹</Link>}
      <h1 className="flex-1 text-lg font-bold">{title}</h1>
      <span className="flex items-center gap-1 text-xs text-slate-500" title={connected ? "실시간 연결됨" : "연결 끊김 (20초마다 재시도)"}>
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-slate-300"}`} />
        {connected ? "실시간" : "오프라인"}
      </span>
    </header>
  );
}
