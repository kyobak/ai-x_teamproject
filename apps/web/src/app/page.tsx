"use client";
import Link from "next/link";
import { Header } from "@/components/Header";
import { PwaSetup } from "@/components/PwaSetup";
import { ResourceCard } from "@/components/ResourceCard";
import { LevelBadge } from "@/components/LevelBadge";
import { SourceNote } from "@/components/SourceNote";
import { waitText } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/**
 * 통합 대시보드.
 * 맨 위는 디자인 가이드의 시그니처 패턴인 "다크 히어로 + 떠 있는 제품 카드": 지금 가장 빨리 먹을 수 있는 학식 하나를 크게.
 * 그 아래는 흰 캔버스에 종류별 카드. Must(학식·세탁)를 위에, Could(오픈스페이스·주차)를 아래에.
 */
const SECTIONS = [
  { kind: "cafeteria", key: "home.sec.cafeteria" },
  { kind: "laundry", key: "home.sec.laundry" },
  { kind: "shuttle", key: "home.sec.shuttle" },
  { kind: "space", key: "home.sec.space" },
  { kind: "parking", key: "home.sec.parking", mock: true },
];

export default function Home() {
  const { list, loading, error } = useRealtime();
  const t = useT();
  // 히어로: 실측/추정 대기시간이 있는 학식 중 가장 짧은 곳
  const best = list.filter((r) => r.kind === "cafeteria" && r.est_wait_min != null).sort((a, b) => (a.est_wait_min ?? 0) - (b.est_wait_min ?? 0))[0];
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
            <p className="font-display text-2xl">{loading ? "불러오는 중…" : "카메라 실측 대기 중"}</p>
            <p className="mt-1 text-sm text-on-dark-soft">영상 파이프라인이 켜지면 여기에 가장 빠른 학식이 표시됩니다.</p>
          </div>
        )}
      </section>

      <main className="space-y-7 px-4 pb-6 pt-5">
        <PwaSetup />
        {error && <p className="rounded-2xl bg-surface-strong p-3 text-sm text-down">{error}</p>}
        {SECTIONS.map((s) => {
          const items = list.filter((r) => r.kind === s.kind);
          if (!items.length) return null;
          return (
            <section key={s.kind}>
              <h2 className="mb-3 flex items-baseline gap-2 font-display text-base text-ink">
                {t(s.key)}{s.mock && <span className="pill bg-surface-strong px-2 text-[10px] font-sans font-semibold text-muted">{t("mock")}</span>}
              </h2>
              <div className="grid gap-3">{items.map((r) => <ResourceCard key={r.id} r={r} />)}</div>
            </section>
          );
        })}
      </main>
    </>
  );
}
