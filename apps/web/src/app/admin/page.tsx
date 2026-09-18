"use client";
import { useState } from "react";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

/**
 * 관리자/팀원 수동 입력. 센서·카메라가 없는 자원의 대체 경로이자 데모 조작 패널입니다.
 * 프로토타입이라 로그인이 없습니다(배포 전 반드시 추가).
 */
export default function AdminPage() {
  const { list } = useRealtime();
  const [msg, setMsg] = useState<string | null>(null);
  const send = async (body: Parameters<typeof api.adminStatus>[0]) => {
    try { await api.adminStatus(body); setMsg(`${body.resource_id} 반영됨`); } catch (e) { setMsg((e as Error).message); }
  };
  const laundry = list.filter((r) => r.kind === "laundry");
  const levels = list.filter((r) => ["cafeteria", "shuttle", "space", "parking"].includes(r.kind));
  return (
    <>
      <Header title="관리 (수동 입력)" back="/" />
      <main className="space-y-5 p-4">
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">센서·카메라 대체 경로입니다. 관리자 입력은 30분 동안만 유효하며, 카메라 실측이 들어오면 실측이 우선합니다.</p>
        {msg && <p className="text-sm text-blue-700">{msg}</p>}

        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-600">세탁기 상태</h2>
          <div className="space-y-2">
            {laundry.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl bg-white p-3 text-sm">
                <span>{r.name} <span className="text-xs text-slate-400">({r.state})</span></span>
                <div className="flex gap-1">
                  {(["available", "in_use", "unknown"] as const).map((s) => (
                    <button key={s} onClick={() => send({ resource_id: r.id, state: s })}
                      className={`rounded-lg px-2 py-1 text-xs ring-1 ${r.state === s ? "bg-slate-900 text-white ring-slate-900" : "ring-slate-200"}`}>
                      {s === "available" ? "비움" : s === "in_use" ? "사용중" : "불명"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-600">혼잡도 (학식·셔틀·오픈스페이스·주차)</h2>
          <div className="space-y-2">
            {levels.map((r) => (
              <div key={r.id} className="rounded-xl bg-white p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>{r.name}</span>
                  <div className="flex gap-1">
                    {(["relaxed", "normal", "crowded"] as const).map((l) => (
                      <button key={l} onClick={() => send({ resource_id: r.id, occupancy_level: l })} className="rounded-lg px-2 py-1 text-xs ring-1 ring-slate-200">
                        {l === "relaxed" ? "여유" : l === "normal" ? "보통" : "혼잡"}
                      </button>
                    ))}
                  </div>
                </div>
                {(r.kind === "space" || r.kind === "parking") && (
                  <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = Number((e.currentTarget.elements.namedItem("n") as HTMLInputElement).value); send({ resource_id: r.id, occupancy_count: v, occupancy_level: r.capacity ? (v / r.capacity < 0.5 ? "relaxed" : v / r.capacity < 0.85 ? "normal" : "crowded") : undefined }); }}>
                    <input name="n" type="number" min={0} placeholder={`현재 인원/차량 (정원 ${r.capacity ?? "?"})`} className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-sm" />
                    <button className="rounded-lg bg-slate-900 px-3 py-1 text-xs text-white">입력</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl bg-white p-3 text-xs text-slate-600">
          <p className="font-medium">데모 시나리오 실행 명령 (노트북 터미널)</p>
          <pre className="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-[11px]">{`.venv/bin/python vision/run_video.py --loop --show
.venv/bin/python sensors/simulate_washer.py --resource laundry-w1 --speed 20`}</pre>
        </section>
      </main>
    </>
  );
}
