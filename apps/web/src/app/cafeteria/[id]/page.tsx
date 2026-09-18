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
import { useRealtime } from "@/lib/realtime";

/**
 * 학식 상세 (슬라이스 A). 발표의 핵심 화면:
 *   예상 대기 = 줄 인원 ÷ 분당 처리 인원
 * 세 숫자를 나란히 보여줘 "인원 수와 대기시간은 다르다" 를 화면에서 바로 설명할 수 있게 했습니다.
 */
export default function CafeteriaPage() {
  const { id } = useParams<{ id: string }>();
  const { resources, deviceId } = useRealtime();
  const r = resources[id];
  const [hist, setHist] = useState<number[]>([]);

  // 상세 화면에 들어올 때와 자원이 갱신될 때마다 최근 인원 추이를 다시 받음
  useEffect(() => {
    api.history(id).then((rows) => setHist(rows.map((x) => Number(x.people_count ?? 0)))).catch(() => {});
  }, [id, r?.updated_at]);

  if (!r) return (<><Header title="학식" back="/" /><p className="p-4 text-sm text-slate-500">불러오는 중…</p></>);
  const measured = r.source === "vision" || r.source === "vision-fallback-throughput";

  return (
    <>
      <Header title={r.name} back="/" />
      <main className="space-y-4 p-4">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">{r.zone}</p>
          <div className="mt-1 flex items-end justify-between">
            <div>
              <p className="text-sm text-slate-600">지금 서면</p>
              <p className="text-4xl font-bold tabular-nums">{r.est_wait_min != null ? waitText(r.est_wait_min) : r.level_ko}</p>
            </div>
            <LevelBadge level={r.level} size="lg" />
          </div>
          <div className="mt-2"><SourceNote source={r.source} note={r.note} seenAt={r.vision_seen_at} /></div>
        </section>

        {measured && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-600">어떻게 계산했나</h2>
            <div className="grid grid-cols-3 items-center text-center">
              <div><p className="text-2xl font-bold tabular-nums">{r.people_count}</p><p className="text-xs text-slate-500">줄 인원(명)</p></div>
              <div><p className="text-2xl font-bold tabular-nums">÷ {r.throughput_per_min}</p><p className="text-xs text-slate-500">분당 처리(명)</p></div>
              <div><p className="text-2xl font-bold tabular-nums">= {r.est_wait_min}</p><p className="text-xs text-slate-500">예상 대기(분)</p></div>
            </div>
            {r.source === "vision-fallback-throughput" && (
              <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">통과선이 카메라 시야에 없어 처리율은 시간대 평균 상수를 썼습니다. (REQ-VIS-05)</p>
            )}
            <p className="mt-3 text-xs text-slate-500">최근 줄 인원 추이</p>
            <Sparkline values={hist} />
            {r.confidence != null && <p className="text-[11px] text-slate-400">검출 신뢰도 평균 {Math.round(r.confidence * 100)}% · 영상은 저장하지 않고 숫자만 받습니다</p>}
          </section>
        )}

        {!measured && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            카메라 신호가 없어 {r.source === "report" ? `사용자 제보 ${r.report_count}건` : r.source === "admin" ? "관리자 입력" : "시간대별 과거 평균"} 으로 대체 표시 중입니다.
          </section>
        )}

        {r.menu && r.menu.length > 0 && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-600">오늘 메뉴</h2>
            <ul className="divide-y divide-slate-100">
              {r.menu.map((m) => (
                <li key={m.name} className="flex justify-between py-2 text-sm"><span>{m.name}</span><span className="tabular-nums text-slate-500">{m.price ? `${m.price.toLocaleString()}원` : ""}</span></li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <ReportButtons resourceId={r.id} deviceId={deviceId} />
        </section>
      </main>
    </>
  );
}
