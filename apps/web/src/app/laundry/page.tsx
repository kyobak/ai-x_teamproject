"use client";
import Link from "next/link";
import { Header } from "@/components/Header";
import { PwaSetup } from "@/components/PwaSetup";
import { useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/** 세탁·건조 1단계: 기숙사 관 선택. 각 관의 빈 세탁기/건조기 수와 대기 인원을 요약합니다. */
const BUILDINGS = [{ key: "injae", name: "인재관" }, { key: "changui", name: "창의관" }, { key: "haengbok", name: "행복관" }];

export default function LaundryHub() {
  const { list } = useRealtime();
  const t = useT();
  return (
    <>
      <Header title={t("hub.laundry")} back="/" />
      <main className="space-y-3 p-4">
        <PwaSetup />
        {BUILDINGS.map((b) => {
          const ms = list.filter((r) => r.kind === "laundry" && r.building === b.key);
          const w = ms.filter((r) => r.machine_type === "washer"), d = ms.filter((r) => r.machine_type === "dryer");
          const fw = w.filter((r) => r.state === "available").length, fd = d.filter((r) => r.state === "available").length;
          const q = ms.reduce((a, r) => a + (r.queue_length ?? 0), 0);
          return (
            <Link key={b.key} href={`/laundry/${b.key}`} className="card block p-5 transition active:bg-surface-soft">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg text-ink">{b.name} 세탁실</h2>
                <span className="text-xl text-muted-soft">›</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-surface-soft p-3"><p className={`font-display text-2xl tabular-nums ${fw ? "text-up" : "text-down"}`}>{fw}<span className="text-sm text-muted">/{w.length}</span></p><p className="text-[11px] text-muted">빈 세탁기</p></div>
                <div className="rounded-2xl bg-surface-soft p-3"><p className={`font-display text-2xl tabular-nums ${fd ? "text-up" : "text-down"}`}>{fd}<span className="text-sm text-muted">/{d.length}</span></p><p className="text-[11px] text-muted">빈 건조기</p></div>
                <div className="rounded-2xl bg-surface-soft p-3"><p className="font-display text-2xl tabular-nums text-ink">{q}</p><p className="text-[11px] text-muted">대기 인원</p></div>
              </div>
            </Link>
          );
        })}
        <p className="text-xs text-muted">앱은 안내 도구이며 실제로 먼저 온 사람이 우선입니다. 기기가 비면 1순위에게 알려드립니다.</p>
      </main>
    </>
  );
}
