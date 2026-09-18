"use client";
import { useState } from "react";
import { api, type MyTicket, type Resource } from "@/lib/api";
import { agoText, timeText } from "@/lib/format";
import { useT } from "@/lib/i18n";

/**
 * 세탁기 한 대 카드: 상태 + 남은 시간(추정) + 가상 대기열 버튼(알약).
 * "예상" 이라는 말을 빼지 않습니다 (REQ-LAU-06). 상태 불명이면 줄 서기는 되지만 호출은 안 됨을 알립니다 (REQ-LAU-07).
 * 주요 버튼(줄 서기·사용 시작)만 브랜드 파랑, 나머지는 회색 알약 — 파랑은 한 카드에 한 번.
 */
export function MachineCard({ r, ticket, deviceId, onChanged }: { r: Resource; ticket?: MyTicket; deviceId: string; onChanged: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setMsg(null);
    try { await fn(); onChanged(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const stateText = r.state === "available" ? t("laundry.available") : r.state === "in_use" ? t("laundry.in_use") : t("laundry.unknown");
  const stateColor = r.state === "available" ? "text-up" : r.state === "in_use" ? "text-in-use" : "text-muted";

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{r.machine_type === "dryer" ? "건조기" : "세탁기"}</p>
          <h3 className="font-display text-lg text-ink">{r.name}</h3>
        </div>
        <span className={`pill bg-surface-strong px-3 py-1 text-xs font-semibold ${stateColor}`}>{stateText}</span>
      </div>

      <p className="mt-3 font-display text-xl text-ink">{r.state_label}</p>
      {r.state === "in_use" && r.expected_end_at && !r.overdue && (
        <p className="mt-1 text-xs text-muted">예상 종료 {timeText(r.expected_end_at)} · 추정값이며 실제 종료는 센서로 판정</p>
      )}
      {r.avg_cycle_min != null && <p className="text-xs text-muted">이 기기 최근 평균 소요 {r.avg_cycle_min}분</p>}
      <p className="text-xs text-muted-soft">센서 수신 {r.last_sample_at ? agoText(r.last_sample_at) : "없음"} · {t("laundry.waiting")} {r.queue_length ?? 0}{t("people.unit")}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!ticket && (
          <button disabled={busy} onClick={() => run(() => api.joinQueue(r.id, deviceId))}
            className="pill h-11 bg-primary px-5 text-sm font-semibold text-white active:bg-primary-active disabled:bg-primary-disabled">
            {t("laundry.join")}
          </button>
        )}
        {ticket?.status === "waiting" && (
          <>
            <span className="pill h-11 inline-flex items-center bg-surface-strong px-4 text-sm text-ink">내 순번 {ticket.position}번 · 앞에 {ticket.people_ahead}명</span>
            <button disabled={busy} onClick={() => run(() => api.leaveQueue(r.id, deviceId))} className="text-sm text-primary">{t("laundry.leave")}</button>
          </>
        )}
        {ticket?.status === "called" && (
          <>
            <button disabled={busy} onClick={() => run(() => api.startUsing(r.id, deviceId))}
              className="pill h-11 animate-pulse bg-primary px-5 text-sm font-semibold text-white">
              {t("laundry.start")}
            </button>
            <button disabled={busy} onClick={() => run(() => api.leaveQueue(r.id, deviceId))} className="text-sm text-muted">{t("laundry.giveup")}</button>
          </>
        )}
      </div>
      {r.state === "unknown" && <p className="mt-2 text-xs text-warn">센서 신호가 없어 이 기기는 자동 호출되지 않습니다.</p>}
      {msg && <p className="mt-2 text-xs text-down">{msg}</p>}
    </div>
  );
}
