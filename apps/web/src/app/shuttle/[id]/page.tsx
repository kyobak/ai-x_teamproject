"use client";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { LevelBadge } from "@/components/LevelBadge";
import { ReportButtons } from "@/components/ReportButtons";
import { SourceNote } from "@/components/SourceNote";
import { useD, useL, useLang, useT } from "@/lib/i18n";
import { boardNote } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";

/**
 * 셔틀 2단계: 한 방향의 상세. 핵심 두 숫자: "다음 차까지 n분", "지금 줄 서면 몇 시 차".
 * 탑승 예측 = 다음 출발 목록[⌊줄 인원 ÷ 정원⌋] (REQ-SHT-03). 소요 시간은 시간표 노선 기준.
 */
export default function ShuttleDetail() {
  const { id } = useParams<{ id: string }>();
  const { resources, deviceId } = useRealtime();
  const t = useT();
  const L = useL();
  const D = useD();
  const lang = useLang();
  const r = resources[id];
  if (!r) return (<><Header title={L("셔틀", "Shuttle")} back="/shuttle" /><p className="p-4 text-sm text-muted">{L("불러오는 중…", "Loading…")}</p></>);
  return (
    <>
      <Header title={D(r.name)} back="/shuttle" />
      <main className="space-y-4 p-4">
        <section className="card p-6">
          <p className="text-xs text-muted">{L(`${r.zone} 정류장 출발`, `From ${D(r.zone)} stop`)} {r.travel_min ? L(`· 소요 약 ${r.travel_min}분`, `· ~${r.travel_min} min ride`) : ""}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-body">{L("다음 차까지", "Next bus in")}</p>
              <p className="font-display text-5xl tabular-nums text-ink">{r.next_in_min == null ? L("운행 종료", "No more buses") : r.next_in_min === 0 ? L("지금 출발", "Leaving now") : L(`${r.next_in_min}분`, `${r.next_in_min} min`)}</p>
              <p className="mt-1 text-sm text-body">{r.upcoming?.length ? L(`${r.upcoming[0].time} 출발`, `Departs ${r.upcoming[0].time}`) : L("오늘 남은 차가 없습니다", "No more buses today")}</p>
            </div>
            <LevelBadge level={r.level} size="lg" />
          </div>
        </section>

        <section className="rounded-[24px] bg-surface-dark p-6 text-white">
          <p className="text-xs text-on-dark-soft">{L("지금 줄 서면", "If you line up now")}</p>
          <p className="mt-1 font-display text-4xl tabular-nums">{r.board_time ? L(`${r.board_time} 차`, `${r.board_time} bus`) : "—"}</p>
          <p className="mt-1 text-sm text-on-dark-soft">
            {r.board_in_min != null ? L(`${r.board_in_min}분 뒤 출발 · `, `departs in ${r.board_in_min} min · `) : ""}{boardNote(r, lang)}
            {r.buses_to_wait != null && r.buses_to_wait > 0 ? L(` (${r.buses_to_wait}대 뒤)`, ` (${r.buses_to_wait} bus(es) later)`) : ""}
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
                <span className={`${i === (r.buses_to_wait ?? 0) ? "pill bg-primary px-3 py-0.5 text-xs font-semibold text-white" : "text-muted"}`}>{i === (r.buses_to_wait ?? 0) ? L("탑승 예상", "You board") : L(`${u.in_min}분 후`, `in ${u.in_min} min`)}</span>
              </li>
            ))}
            {!r.upcoming?.length && <li className="py-2 text-sm text-muted">{L("오늘 운행 종료", "No more buses today")}</li>}
          </ul>
          <p className="mt-3 text-[11px] text-muted-soft">{L("출처: 한양대 ERICA 셔틀버스 운행노선&시간표 2023.09.01 (학기 중). 평일 오전은 예술인APT 직행, 오후는 순환 노선 혼합, 19시 이후 전 노선 순환.", "Source: Hanyang ERICA shuttle routes & timetable 2023-09-01 (semester). Weekday mornings run direct to Artists' APT, afternoons mix in the loop route, and after 19:00 all buses run the loop.")}</p>
        </section>

        <section className="card p-6"><ReportButtons resourceId={r.id} deviceId={deviceId} /></section>
      </main>
    </>
  );
}
