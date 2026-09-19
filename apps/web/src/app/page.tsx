"use client";
import Link from "next/link";
import { Header } from "@/components/Header";
import { HubCard } from "@/components/Hub";
import { LevelBadge } from "@/components/LevelBadge";
import { PwaSetup } from "@/components/PwaSetup";
import { SourceNote } from "@/components/SourceNote";
import { waitText } from "@/lib/format";
import { useD, useL, useLang, useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/**
 * 홈 = 분야 허브. 다크 히어로(가장 빠른 학식) 아래에 4개 분야 타일. 타일을 누르면 세부 목록 → 상세로 내려갑니다.
 * 각 타일의 요약 한 줄은 실시간 자원 목록에서 계산합니다.
 */
export default function Home() {
  const { list, loading, error } = useRealtime();
  const t = useT();
  const L = useL();
  const D = useD();
  const lang = useLang();
  // 학식 정렬: 예상 대기(분)가 있으면 그것으로, 없으면 혼잡 단계로 (여유 < 보통 < 혼잡). 제보만 있는 식당도 히어로에 오를 수 있게.
  const RANK: Record<string, number> = { relaxed: 0, normal: 1, crowded: 2, unknown: 3 };
  const score = (r: (typeof list)[number]) => (r.est_wait_min != null ? r.est_wait_min : 100 + RANK[r.level ?? "unknown"] * 100);
  const allCafes = list.filter((r) => r.kind === "cafeteria" && (r.est_wait_min != null || (r.level && r.level !== "unknown")));
  const cafes = [...allCafes].sort((a, b) => score(a) - score(b));
  const best = cafes[0];
  const allCrowded = allCafes.length > 0 && allCafes.every((r) => r.level === "crowded");
  const washers = list.filter((r) => r.kind === "laundry");
  const freeW = washers.filter((r) => r.machine_type === "washer" && r.state === "available").length;
  const freeD = washers.filter((r) => r.machine_type === "dryer" && r.state === "available").length;
  const spaces = list.filter((r) => r.kind === "space" && r.occupancy_count != null && r.capacity).sort((a, b) => (a.occupancy_count! / a.capacity!) - (b.occupancy_count! / b.capacity!));
  const main = list.find((r) => r.id === "shuttle-shuttlecock-hanyang");
  return (
    <>
      <Header title={t("home.title")} dark />
      <section className="bg-surface-dark px-4 pb-8 pt-4 text-white">
        <p className="text-xs text-on-dark-soft">{t("home.hero.kicker")}</p>
        {allCrowded ? (
          <Link href="/cafeteria" className="mt-3 block rounded-[24px] bg-surface-dark-elevated p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-on-dark-soft">{L("지금은", "Right now")}</p>
                <p className="mt-1 font-display text-4xl">{L("모든 식당 혼잡", "Every cafeteria is busy")}</p>
              </div>
              <LevelBadge level="crowded" />
            </div>
            <p className="mt-3 text-sm text-on-dark-soft">{L(`구내식당·푸드코트 ${allCafes.length}곳 모두 혼잡입니다. 시간대별 예측을 보고 방문 시간을 미루는 것을 권합니다.`, `All ${allCafes.length} cafeterias and food courts are busy. Check the forecast and consider going a bit later.`)}</p>
          </Link>
        ) : best ? (
          <Link href={`/cafeteria/${best.id}`} className="mt-3 block rounded-[24px] bg-surface-dark-elevated p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-on-dark-soft">{D(best.name)} · {t("home.hero.wait")}</p>
                <p className="mt-1 font-display text-5xl tabular-nums">{best.est_wait_min != null ? waitText(best.est_wait_min, lang) : t(`level.${best.level ?? "unknown"}`)}</p>
              </div>
              <LevelBadge level={best.level} />
            </div>
            <p className="mt-3 text-sm text-on-dark-soft">{best.people_count != null ? `${t("queue.people")} ${best.people_count}${t("people.unit")} ÷ ${best.throughput_per_min}${L("/분", "/min")}` : ""}</p>
            <div className="mt-1 [&_p]:text-on-dark-soft"><SourceNote source={best.source} note={best.note} seenAt={best.vision_seen_at} /></div>
          </Link>
        ) : (
          <div className="mt-3 rounded-[24px] bg-surface-dark-elevated p-6">
            <p className="font-display text-2xl">{loading ? L("불러오는 중…", "Loading…") : L("학식 정보 없음", "No cafeteria data")}</p>
          </div>
        )}
      </section>

      <main className="space-y-3 px-4 pb-6 pt-5">
        <PwaSetup />
        {error && <p className="rounded-2xl bg-surface-strong p-3 text-sm text-down">{D(error)}</p>}
        <HubCard href="/laundry" icon="◎" title={t("hub.laundry")} sub={t("hub.laundry.sub")}
          summary={washers.length ? L(`지금 빈 세탁기 ${freeW}대 · 건조기 ${freeD}대`, `Free now: ${freeW} washers · ${freeD} dryers`) : undefined} />
        <HubCard href="/space" icon="▦" title={t("hub.space")} sub={t("hub.space.sub")}
          summary={spaces[0] ? `${L("가장 여유", "Most room")}: ${D(spaces[0].zone)} ${spaces[0].occupancy_count}/${spaces[0].capacity}` : undefined} />
        <HubCard href="/shuttle" icon="▷" title={t("hub.shuttle")} sub={t("hub.shuttle.sub")}
          summary={main ? L(`셔틀콕→한대앞역 ${main.next_in_min == null ? "운행 종료" : `${main.next_in_min}분 후 출발`} · 줄 ${main.people_count ?? "-"}명`, `Shuttlecock→Station: ${main.next_in_min == null ? "no more buses" : `leaves in ${main.next_in_min} min`} · ${main.people_count ?? "-"} in line`) : undefined} />
        <HubCard href="/cafeteria" icon="◒" title={t("hub.cafeteria")} sub={t("hub.cafeteria.sub")}
          summary={allCrowded ? L("모든 식당 혼잡", "Every cafeteria is busy") : best ? `${L("가장 빠른 곳", "Fastest")}: ${D(best.name)} ${best.est_wait_min != null ? waitText(best.est_wait_min, lang) : t(`level.${best.level ?? "unknown"}`)}` : undefined} />
        {list.filter((r) => r.kind === "parking").map((r) => (
          <Link key={r.id} href="/admin" className="card flex items-center justify-between p-4 text-sm">
            <span className="text-body">{D(r.name)} <span className="pill ml-1 bg-surface-strong px-2 text-[10px] text-muted">{t("mock")}</span></span>
            <span className="font-display text-ink">{r.occupancy_count ?? "—"}{r.capacity ? ` / ${r.capacity}` : ""}</span>
          </Link>
        ))}
      </main>
    </>
  );
}
