"use client";
import { Header } from "@/components/Header";
import { LevelBadge } from "@/components/LevelBadge";
import { ReportButtons } from "@/components/ReportButtons";
import { SourceNote } from "@/components/SourceNote";
import { useRealtime } from "@/lib/realtime";

/** 셔틀 (Should). 학식과 같은 비전 수치를 쓰되 "몇 대 뒤 탑승" 을 정원과 시간표로 계산합니다 (REQ-SHT-03). GPS 는 쓰지 않고 정류장을 고릅니다. */
export default function ShuttlePage() {
  const { list, deviceId } = useRealtime();
  const stops = list.filter((r) => r.kind === "shuttle");
  return (
    <>
      <Header title="셔틀" back="/" />
      <main className="space-y-4 p-4">
        {stops.map((r) => (
          <section key={r.id} className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs text-slate-500">{r.zone}</p>
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">{r.name}</h2>
              <LevelBadge level={r.level} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 p-2"><p className="text-xl font-bold tabular-nums">{r.people_count ?? "—"}</p><p className="text-[11px] text-slate-500">줄 인원</p></div>
              <div className="rounded-xl bg-slate-50 p-2"><p className="text-xl font-bold tabular-nums">{r.capacity ?? "—"}</p><p className="text-[11px] text-slate-500">버스 정원</p></div>
              <div className="rounded-xl bg-blue-50 p-2"><p className="text-xl font-bold tabular-nums text-blue-800">{r.buses_to_wait == null ? "—" : r.buses_to_wait === 0 ? "다음 차" : `${r.buses_to_wait}대 뒤`}</p><p className="text-[11px] text-slate-500">탑승 가능</p></div>
            </div>
            <p className="mt-3 text-sm text-slate-700">다음 출발 {r.next_departures?.length ? r.next_departures.join(" · ") : "오늘 운행 종료"}</p>
            <div className="mt-1"><SourceNote source={r.source} note={r.note} seenAt={r.vision_seen_at} /></div>
            <div className="mt-4"><ReportButtons resourceId={r.id} deviceId={deviceId} /></div>
          </section>
        ))}
        <p className="text-xs text-slate-500">시간표는 공개 자료 기준 예시이며 실제 운행 시간과 다를 수 있습니다.</p>
      </main>
    </>
  );
}
