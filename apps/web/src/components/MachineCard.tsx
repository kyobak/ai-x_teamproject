"use client";
import { useState } from "react";
import { api, type MyTicket, type Resource } from "@/lib/api";
import { agoText, timeText } from "@/lib/format";

/**
 * 세탁기 한 대 카드: 상태 + 남은 시간(추정) + 가상 대기열 버튼.
 * "예상" 이라는 말을 빼지 않습니다 (REQ-LAU-06). 상태 불명이면 줄 서기를 막지는 않지만 호출은 되지 않음을 알립니다 (REQ-LAU-07).
 */
export function MachineCard({ r, ticket, deviceId, onChanged }: { r: Resource; ticket?: MyTicket; deviceId: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setMsg(null);
    try { await fn(); onChanged(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };

  const stateStyle =
    r.state === "available" ? "border-emerald-300 bg-emerald-50" :
    r.state === "in_use" ? "border-blue-200 bg-white" : "border-slate-200 bg-slate-50";

  return (
    <div className={`rounded-2xl border p-4 ${stateStyle}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500">{r.machine_type === "dryer" ? "건조기" : "세탁기"}</p>
          <h3 className="text-lg font-semibold text-slate-900">{r.name}</h3>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${r.state === "available" ? "bg-emerald-600 text-white" : r.state === "in_use" ? "bg-blue-600 text-white" : "bg-slate-400 text-white"}`}>
          {r.state === "available" ? "사용 가능" : r.state === "in_use" ? "사용 중" : "상태 불명"}
        </span>
      </div>

      <p className="mt-2 text-base text-slate-800">{r.state_label}</p>
      {r.state === "in_use" && r.expected_end_at && !r.overdue && (
        <p className="text-xs text-slate-500">예상 종료 {timeText(r.expected_end_at)} · 추정값이며 실제 종료는 센서로 판정</p>
      )}
      {r.avg_cycle_min != null && <p className="text-xs text-slate-500">이 기기 최근 평균 소요 {r.avg_cycle_min}분</p>}
      <p className="text-xs text-slate-400">센서 수신 {r.last_sample_at ? agoText(r.last_sample_at) : "없음"} · 대기 {r.queue_length ?? 0}명</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!ticket && (
          <button disabled={busy} onClick={() => run(() => api.joinQueue(r.id, deviceId))}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            줄 서기
          </button>
        )}
        {ticket?.status === "waiting" && (
          <>
            <span className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">내 순번 {ticket.position}번 · 앞에 {ticket.people_ahead}명</span>
            <button disabled={busy} onClick={() => run(() => api.leaveQueue(r.id, deviceId))} className="text-sm text-slate-500 underline">취소</button>
          </>
        )}
        {ticket?.status === "called" && (
          <>
            <button disabled={busy} onClick={() => run(() => api.startUsing(r.id, deviceId))}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white animate-pulse">
              내 차례! 사용 시작
            </button>
            <button disabled={busy} onClick={() => run(() => api.leaveQueue(r.id, deviceId))} className="text-sm text-slate-500 underline">포기</button>
          </>
        )}
      </div>
      {r.state === "unknown" && <p className="mt-2 text-xs text-amber-700">센서 신호가 없어 이 기기는 자동 호출되지 않습니다.</p>}
      {msg && <p className="mt-2 text-xs text-rose-600">{msg}</p>}
    </div>
  );
}
