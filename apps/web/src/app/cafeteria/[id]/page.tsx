"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { LevelBadge } from "@/components/LevelBadge";
import { ReportButtons } from "@/components/ReportButtons";
import { SourceNote } from "@/components/SourceNote";
import { Sparkline } from "@/components/Sparkline";
import { api } from "@/lib/api";
import { waitText } from "@/lib/format";
import { useD, useL, useLang, useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/**
 * 학식 상세 (슬라이스 A). 발표의 핵심 화면: 예상 대기 = 줄 인원 ÷ 분당 처리 인원.
 * 메뉴는 복지포털 데이터(조식/중식/석식)를 끼니별로 묶어 보여주고, 푸드코트는 입점 매장 목록을 보여줍니다.
 */
const MEAL: Record<string, { ko: string; en: string }> = { breakfast: { ko: "조식", en: "Breakfast" }, lunch: { ko: "중식", en: "Lunch" }, dinner: { ko: "석식", en: "Dinner" } };

export default function CafeteriaPage() {
  const { id } = useParams<{ id: string }>();
  const { resources, deviceId } = useRealtime();
  const t = useT();
  const L = useL();
  const D = useD();
  const lang = useLang();
  const r = resources[id];
  const [hist, setHist] = useState<number[]>([]);
  useEffect(() => {
    api.history(id).then((rows) => setHist(rows.map((x) => Number(x.people_count ?? 0)))).catch(() => {});
  }, [id, r?.updated_at]);

  if (!r) return (<><Header title={L("학식", "Cafeteria")} back="/cafeteria" /><p className="p-4 text-sm text-muted">{L("불러오는 중…", "Loading…")}</p></>);
  // 시연용 수치(demo)도 인원·처리율이 있으므로 계산식을 보여줍니다 (출처 표시는 SourceNote 가 "시연용" 으로 정직하게 함)
  const measured = r.source === "vision" || r.source === "vision-fallback-throughput" || r.source === "demo";
  const meals = ["breakfast", "lunch", "dinner"].map((m) => ({ m, items: (r.menu ?? []).filter((x) => x.meal === m) })).filter((g) => g.items.length);
  const flat = (r.menu ?? []).filter((x) => !x.meal);

  return (
    <>
      <Header title={D(r.name)} back="/cafeteria" />
      <main className="space-y-4 p-4">
        <section className="card p-6">
          <p className="text-xs text-muted">{D(r.zone)}{r.hours ? ` · ${D(r.hours)}` : ""}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-body">{t("home.hero.wait")}</p>
              <p className="font-display text-5xl tabular-nums text-ink">{r.est_wait_min != null ? waitText(r.est_wait_min, lang) : t(`level.${r.level ?? "unknown"}`)}</p>
            </div>
            <LevelBadge level={r.level} size="lg" />
          </div>
          <div className="mt-3"><SourceNote source={r.source} note={r.note} seenAt={r.vision_seen_at} /></div>
        </section>

        {measured && (
          <section className="card p-6">
            <h2 className="mb-4 font-display text-base text-ink">{t("cafe.how")}</h2>
            <div className="grid grid-cols-3 items-center text-center">
              <div><p className="font-display text-2xl tabular-nums">{r.people_count}</p><p className="text-[11px] text-muted">{t("cafe.count")}</p></div>
              <div><p className="font-display text-2xl tabular-nums">÷ {r.throughput_per_min}</p><p className="text-[11px] text-muted">{t("cafe.thr")}</p></div>
              <div><p className="font-display text-2xl tabular-nums text-primary">= {r.est_wait_min}</p><p className="text-[11px] text-muted">{t("cafe.wait")}</p></div>
            </div>
            {r.source === "vision-fallback-throughput" && (
              <p className="mt-4 rounded-2xl bg-surface-soft p-3 text-xs text-warn">{L("통과선이 카메라 시야에 없어 처리율은 시간대 평균 상수를 썼습니다. (REQ-VIS-05)", "The serving line is outside the camera view, so the hourly average service rate was used. (REQ-VIS-05)")}</p>
            )}
            <p className="mt-4 text-xs text-muted">{t("cafe.trend")}</p>
            <Sparkline values={hist} emptyText={L("데이터가 더 쌓이면 그래프가 표시됩니다", "The chart appears once more data comes in")} label={t("cafe.trend")} />
            {r.confidence != null && <p className="text-[11px] text-muted-soft">{L(`검출 신뢰도 평균 ${Math.round(r.confidence * 100)}% · 영상은 저장하지 않고 숫자만 받습니다`, `Average detection confidence ${Math.round(r.confidence * 100)}% · no video is stored, only numbers`)}</p>}
          </section>
        )}
        {!measured && (
          <section className="rounded-[24px] bg-surface-soft p-5 text-sm text-body">
            {r.source === "report" ? L(`카메라 신호가 없어 사용자 제보 ${r.report_count}건으로 대체 표시 중입니다.`, `No camera signal, showing ${r.report_count} user report(s) instead.`)
              : r.source === "admin" ? L("카메라 신호가 없어 관리자 입력으로 대체 표시 중입니다.", "No camera signal, showing admin input instead.")
              : L("카메라 신호가 없어 시간대별 과거 평균으로 대체 표시 중입니다.", "No camera signal, showing the historical average for this time instead.")}
          </section>
        )}

        {(meals.length > 0 || flat.length > 0) && (
          <section className="card p-6">
            <h2 className="mb-2 font-display text-base text-ink">{t("cafe.menu")}</h2>
            {meals.map((g) => (
              <div key={g.m} className="mt-3">
                <p className="pill inline-block bg-surface-strong px-2.5 py-0.5 text-[11px] font-semibold text-body">{MEAL[g.m][lang]}</p>
                <ul className="mt-1 divide-y divide-hairline-soft">
                  {g.items.map((m) => (
                    <li key={m.name} className="py-2.5">
                      <div className="flex justify-between text-sm"><span className="font-semibold text-ink">{D(m.name)}</span><span className="font-mono tabular-nums text-body">{m.price ? L(`${m.price.toLocaleString()}원`, `₩${m.price.toLocaleString()}`) : ""}</span></div>
                      {m.items?.length ? <p className="mt-0.5 text-xs text-muted">{m.items.map((x) => D(x)).join(" · ")}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {flat.length > 0 && (
              <ul className="divide-y divide-hairline-soft">
                {flat.map((m) => <li key={m.name} className="flex justify-between py-2.5 text-sm"><span>{D(m.name)}</span><span className="font-mono tabular-nums text-body">{m.price ? L(`${m.price.toLocaleString()}원`, `₩${m.price.toLocaleString()}`) : ""}</span></li>)}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-muted-soft">{L("출처: 한양대 ERICA 복지포털(life.hanyang.ac.kr) 공개 데이터 · jobs/crawl_menu.py 로 갱신", "Source: Hanyang ERICA welfare portal (life.hanyang.ac.kr) public data · updated by jobs/crawl_menu.py")}</p>
          </section>
        )}

        {r.vendors && r.vendors.length > 0 && (
          <section className="card p-6">
            <h2 className="mb-2 font-display text-base text-ink">{t("cafe.vendors")}</h2>
            <ul className="divide-y divide-hairline-soft">
              {r.vendors.map((v) => (
                <li key={v.name} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-strong text-xs text-body">{lang === "en" ? D(v.category ?? "매장").slice(0, 4) : (v.category ?? "매장").slice(0, 2)}</span>
                  <span className="flex-1 text-ink">{D(v.name)}</span>
                  {v.hours && <span className="text-xs text-muted">{D(v.hours)}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card p-6"><ReportButtons resourceId={r.id} deviceId={deviceId} /></section>
      </main>
    </>
  );
}
