"use client";
import { Header } from "@/components/Header";
import { PwaSetup } from "@/components/PwaSetup";
import { ResourceCard } from "@/components/ResourceCard";
import { useRealtime } from "@/lib/realtime";

/** 통합 대시보드: 종류별로 묶어 카드 나열. Must 인 학식·세탁을 위에, Could 인 오픈스페이스·주차를 아래에 둡니다. */
const SECTIONS: { kind: string; title: string; note?: string }[] = [
  { kind: "cafeteria", title: "학식 · 지금 가면 얼마나 기다릴까" },
  { kind: "laundry", title: "세탁실" },
  { kind: "shuttle", title: "셔틀" },
  { kind: "space", title: "오픈스페이스", note: "목업" },
  { kind: "parking", title: "주차장", note: "목업" },
];

export default function Home() {
  const { list, loading, error } = useRealtime();
  return (
    <>
      <Header title="ERICA 캠퍼스 대기 현황" />
      <main className="space-y-6 p-4">
        <PwaSetup />
        {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {loading && !error && <p className="text-sm text-slate-500">불러오는 중…</p>}
        {SECTIONS.map((s) => {
          const items = list.filter((r) => r.kind === s.kind);
          if (!items.length) return null;
          return (
            <section key={s.kind}>
              <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-slate-600">
                {s.title}{s.note && <span className="rounded bg-slate-200 px-1.5 text-[10px] text-slate-600">{s.note}</span>}
              </h2>
              <div className="grid gap-3">{items.map((r) => <ResourceCard key={r.id} r={r} />)}</div>
            </section>
          );
        })}
      </main>
    </>
  );
}
