"use client";
import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { HanyangQueue } from "@/components/HanyangQueue";
import { LevelBadge } from "@/components/LevelBadge";
import { SourceNote } from "@/components/SourceNote";
import type { Resource } from "@/lib/api";
import { useD, useL, useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/**
 * 셔틀 1단계: 두 정류장(셔틀콕 → 한대앞역, 한대앞역 → 셔틀콕·창의인재원)에 하냥이들이 줄을 선 모습.
 * 카드를 누르면 상세(줄 인원·버스 정원·다음 출발·지금 서면 몇 시 차)로 들어갑니다.
 */
function StopCard({ r }: { r: Resource }) {
  const t = useT();
  const L = useL();
  const D = useD();
  const [demoKey, setDemoKey] = useState(0);
  return (
    <section className="card overflow-hidden p-0">
      <Link href={`/shuttle/${r.id}`} className="block p-4 pb-3 transition active:bg-surface-soft">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">{L(`${r.zone} 정류장`, `${D(r.zone)} stop`)}</p>
            <h2 className="truncate font-display text-lg text-ink">{D(r.name)}</h2>
          </div>
          <LevelBadge level={r.level} size="sm" />
        </div>
        <HanyangQueue people={r.people_count} capacity={r.capacity} nextDeparture={r.next_departures?.[0]} stopName={D(r.zone)} demoKey={demoKey} />
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div><p className="font-display text-xl tabular-nums text-ink">{r.people_count ?? "—"}<span className="text-xs text-muted">{L("명", "")}</span></p><p className="text-[10px] text-muted">{t("shuttle.people")}</p></div>
          <div><p className="font-display text-xl tabular-nums text-ink">{r.next_in_min == null ? "—" : r.next_in_min === 0 ? L("지금", "Now") : L(`${r.next_in_min}분`, `${r.next_in_min} min`)}</p><p className="text-[10px] text-muted">{L("다음 차", "Next bus")} {r.next_departures?.[0] ?? L("운행 종료", "none")}</p></div>
          <div><p className="font-display text-xl tabular-nums text-primary">{r.board_time ?? "—"}</p><p className="text-[10px] text-muted">{L("지금 서면 탈 차", "Your bus if you line up now")}</p></div>
        </div>
      </Link>
      <div className="flex items-center justify-between border-t border-hairline-soft px-4 py-2">
        <SourceNote source={r.source} note={r.note} seenAt={r.vision_seen_at} />
        <button onClick={() => setDemoKey((k) => k + 1)} className="pill shrink-0 bg-surface-strong px-3 py-1 text-[11px] font-semibold text-primary">{L("▶ 버스 도착 시연", "▶ Demo bus arrival")}</button>
      </div>
    </section>
  );
}

export default function ShuttleHub() {
  const { list } = useRealtime();
  const t = useT();
  const L = useL();
  const order = ["shuttle-shuttlecock-hanyang", "shuttle-hanyang-campus"];
  const stops = list.filter((r) => r.kind === "shuttle").sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return (
    <>
      <Header title={t("hub.shuttle")} back="/" />
      <main className="space-y-4 p-4">
        <p className="text-xs text-muted">{L("하냥이 1마리 = 5명 · 줄이 길수록 하냥이가 늘어나고, 버스가 오면 줄어듭니다. 카드를 누르면 상세 정보가 나와요.", "1 Hanyang mascot = 5 people. The line grows as people arrive and shrinks when a bus comes. Tap a card for details.")}</p>
        {stops.map((r) => <StopCard key={r.id} r={r} />)}
        <p className="text-[11px] text-muted-soft">{L("한양대 ERICA 셔틀 시간표(2023.09.01, 학기 중) 기준 · 정류장은 직접 선택 (GPS 미사용)", "Based on the Hanyang ERICA shuttle timetable (2023-09-01, semester) · you pick the stop (no GPS)")}</p>
      </main>
    </>
  );
}
