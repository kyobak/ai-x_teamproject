"use client";
import { Header } from "@/components/Header";
import { LevelBadge } from "@/components/LevelBadge";
import { ReportButtons } from "@/components/ReportButtons";
import { SourceNote } from "@/components/SourceNote";
import { useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/** 셔틀 (Should). 같은 비전 수치 + 정원 + 시간표로 "몇 대 뒤 탑승" (REQ-SHT-03). GPS 없이 정류장 선택. */
export default function ShuttlePage() {
  const { list, deviceId } = useRealtime();
  const t = useT();
  const stops = list.filter((r) => r.kind === "shuttle");
  return (
    <>
      <Header title={t("nav.shuttle")} back="/" />
      <main className="space-y-4 p-4">
        {stops.map((r) => (
          <section key={r.id} className="card p-6">
            <p className="text-xs text-muted">{r.zone}</p>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-lg text-ink">{r.name}</h2>
              <LevelBadge level={r.level} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-surface-soft p-3"><p className="font-display text-xl tabular-nums">{r.people_count ?? "—"}</p><p className="text-[11px] text-muted">{t("shuttle.people")}</p></div>
              <div className="rounded-2xl bg-surface-soft p-3"><p className="font-display text-xl tabular-nums">{r.capacity ?? "—"}</p><p className="text-[11px] text-muted">{t("shuttle.cap")}</p></div>
              <div className="rounded-2xl bg-surface-soft p-3"><p className="font-display text-xl tabular-nums text-primary">{r.buses_to_wait == null ? "—" : r.buses_to_wait === 0 ? t("shuttle.next") : `${r.buses_to_wait}${t("shuttle.later")}`}</p><p className="text-[11px] text-muted">{t("shuttle.board")}</p></div>
            </div>
            <p className="mt-4 text-sm text-ink">{t("shuttle.dep")} <span className="font-mono">{r.next_departures?.length ? r.next_departures.join(" · ") : "오늘 운행 종료"}</span></p>
            <div className="mt-1"><SourceNote source={r.source} note={r.note} seenAt={r.vision_seen_at} /></div>
            <div className="mt-5"><ReportButtons resourceId={r.id} deviceId={deviceId} /></div>
          </section>
        ))}
        <p className="text-xs text-muted">시간표는 공개 자료 기준 예시이며 실제 운행 시간과 다를 수 있습니다.</p>
      </main>
    </>
  );
}
