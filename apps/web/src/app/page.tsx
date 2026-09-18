"use client";
import Link from "next/link";
import { Header } from "@/components/Header";
import { HubCard } from "@/components/Hub";
import { LevelBadge } from "@/components/LevelBadge";
import { PwaSetup } from "@/components/PwaSetup";
import { SourceNote } from "@/components/SourceNote";
import { waitText } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/**
 * 홈 = 분야 허브. 다크 히어로(가장 빠른 학식) 아래에 4개 분야 타일. 타일을 누르면 세부 목록 → 상세로 내려갑니다.
 * 각 타일의 요약 한 줄은 실시간 자원 목록에서 계산합니다.
 */
export default function Home() {
  const { list, loading, error } = useRealtime();
  const t = useT();
  const cafes = list.filter((r) => r.kind === "cafeteria" && r.est_wait_min != null).sort((a, b) => (a.est_wait_min ?? 0) - (b.est_wait_min ?? 0));
  const best = cafes[0];
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
        {best ? (
          <Link href={`/cafeteria/${best.id}`} className="mt-3 block rounded-[24px] bg-surface-dark-elevated p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-on-dark-soft">{best.name} · {t("home.hero.wait")}</p>
                <p className="mt-1 font-display text-5xl tabular-nums">{waitText(best.est_wait_min)}</p>
              </div>
              <LevelBadge level={best.level} />
            </div>
            <p className="mt-3 text-sm text-on-dark-soft">{best.people_count != null ? `${t("queue.people")} ${best.people_count}${t("people.unit")} ÷ ${best.throughput_per_min}/분` : ""}</p>
            <div className="mt-1 [&_p]:text-on-dark-soft"><SourceNote source={best.source} note={best.note} seenAt={best.vision_seen_at} /></div>
          </Link>
        ) : (
          <div className="mt-3 rounded-[24px] bg-surface-dark-elevated p-6">
            <p className="font-display text-2xl">{loading ? "불러오는 중…" : "데이터 준비 중"}</p>
          </div>
        )}
      </section>

      <main className="space-y-3 px-4 pb-6 pt-5">
        <PwaSetup />
        {error && <p className="rounded-2xl bg-surface-strong p-3 text-sm text-down">{error}</p>}
        <HubCard href="/laundry" icon="◎" title={t("hub.laundry")} sub={t("hub.laundry.sub")}
          summary={washers.length ? `지금 빈 세탁기 ${freeW}대 · 건조기 ${freeD}대` : undefined} />
        <HubCard href="/space" icon="▦" title={t("hub.space")} sub={t("hub.space.sub")}
          summary={spaces[0] ? `가장 여유: ${spaces[0].zone} ${spaces[0].occupancy_count}/${spaces[0].capacity}` : undefined} />
        <HubCard href="/shuttle" icon="▷" title={t("hub.shuttle")} sub={t("hub.shuttle.sub")}
          summary={main ? `셔틀콕→한대앞역 ${main.next_in_min == null ? "운행 종료" : `${main.next_in_min}분 후 출발`} · 줄 ${main.people_count ?? "-"}명` : undefined} />
        <HubCard href="/cafeteria" icon="◒" title={t("hub.cafeteria")} sub={t("hub.cafeteria.sub")}
          summary={best ? `가장 빠른 곳: ${best.name} ${waitText(best.est_wait_min)}` : undefined} />
        {list.filter((r) => r.kind === "parking").map((r) => (
          <Link key={r.id} href="/admin" className="card flex items-center justify-between p-4 text-sm">
            <span className="text-body">{r.name} <span className="pill ml-1 bg-surface-strong px-2 text-[10px] text-muted">{t("mock")}</span></span>
            <span className="font-display text-ink">{r.occupancy_count ?? "—"}{r.capacity ? ` / ${r.capacity}` : ""}</span>
          </Link>
        ))}
      </main>
    </>
  );
}
