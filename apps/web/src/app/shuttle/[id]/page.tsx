"use client";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { LevelBadge } from "@/components/LevelBadge";
import { ReportButtons } from "@/components/ReportButtons";
import { SourceNote } from "@/components/SourceNote";
import { useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/**
 * 셔틀 2단계: 한 방향의 상세. 핵심 두 숫자: "다음 차까지 n분", "지금 줄 서면 몇 시 차".
 * 탑승 예측 = 다음 출발 목록[⌊줄 인원 ÷ 정원⌋] (REQ-SHT-03). 소요 시간은 시간표 노선 기준.
 */
export default function ShuttleDetail() {
  const { id } = useParams<{ id: string }>();
  const { resources, deviceId } = useRealtime();
  const t = useT();
  const r = resources[id];
  if (!r) return (<><Header title="셔틀" back="/shuttle" /><p className="p-4 text-sm text-muted">불러오는 중…</p></>);
  return (
    <>
      <Header title={r.name} back="/shuttle" />
      <main className="space-y-4 p-4">
        <section className="card p-6">
          <p className="text-xs text-muted">{r.zone} 정류장 출발 {r.travel_min ? `· 소요 약 ${r.travel_min}분` : ""}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-body">다음 차까지</p>
              <p className="font-display text-5xl tabular-nums text-ink">{r.next_in_min == null ? "운행 종료" : r.next_in_min === 0 ? "지금 출발" : `${r.next_in_min}분`}</p>
              <p className="mt-1 text-sm text-body">{r.upcoming?.length ? `${r.upcoming[0].time} 출발` : "오늘 남은 차가 없습니다"}</p>
            </div>
            <LevelBadge level={r.level} size="lg" />
          </div>
        </section>

        <section className="rounded-[24px] bg-surface-dark p-6 text-white">
          <p className="text-xs text-on-dark-soft">지금 줄 서면</p>
          <p className="mt-1 font-display text-4xl tabular-nums">{r.board_time ? `${r.board_time} 차` : "—"}</p>
          <p className="mt-1 text-sm text-on-dark-soft">
            {r.board_in_min != null ? `${r.board_in_min}분 뒤 출발 · ` : ""}{r.board_note}
            {r.buses_to_wait != null && r.buses_to_wait > 0 ? ` (${r.buses_to_wait}대 뒤)` : ""}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-surface-dark-elevated p-3"><p className="font-display text-2xl tabular-nums">{r.people_count ?? "—"}</p><p className="text-[11px] text-on-dark-soft">{t("shuttle.people")}</p></div>
            <div className="rounded-2xl bg-surface-dark-elevated p-3"><p className="font-display text-2xl tabular-nums">{r.capacity ?? "—"}</p><p className="text-[11px] text-on-dark-soft">{t("shuttle.cap")}</p></div>
          </div>
          <div className="mt-2 [&_p]:text-on-dark-soft"><SourceNote source={r.source} note={r.note} seenAt={r.vision_seen_at} /></div>
        </section>

        <section className="card p-6">
          <h2 className="font-display text-base text-ink">{t("shuttle.dep")}</h2>
          <ul className="mt-2 divide-y divide-hairline-soft">
            {(r.upcoming ?? []).map((u, i) => (
              <li key={u.time} className="flex items-center justify-between py-2.5 text-sm">
                <span className={`font-mono ${i === 0 ? "text-ink" : "text-body"}`}>{u.time}</span>
                <span className={`${i === (r.buses_to_wait ?? 0) ? "pill bg-primary px-3 py-0.5 text-xs font-semibold text-white" : "text-muted"}`}>{i === (r.buses_to_wait ?? 0) ? "탑승 예상" : `${u.in_min}분 후`}</span>
              </li>
            ))}
            {!r.upcoming?.length && <li className="py-2 text-sm text-muted">오늘 운행 종료</li>}
          </ul>
          <p className="mt-3 text-[11px] text-muted-soft">출처: 한양대 ERICA 셔틀버스 운행노선&시간표 2023.09.01 (학기 중). 평일 오전은 예술인APT 직행, 오후는 순환 노선 혼합, 19시 이후 전 노선 순환.</p>
        </section>

        <section className="card p-6"><ReportButtons resourceId={r.id} deviceId={deviceId} /></section>
      </main>
    </>
  );
}
