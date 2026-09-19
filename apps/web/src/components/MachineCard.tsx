"use client";
import { useState } from "react";
import Link from "next/link";
import { api, type MyTicket, type Resource } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { agoText, timeText } from "@/lib/format";
import { useD, useL, useLang, useT } from "@/lib/i18n";

/**
 * 세탁기 한 대 카드: 상태 + 남은 시간(추정) + 가상 대기열 버튼(알약).
 * "예상" 이라는 말을 빼지 않습니다 (REQ-LAU-06). 상태 불명이면 줄 서기는 되지만 호출은 안 됨을 알립니다 (REQ-LAU-07).
 * 주요 버튼(줄 서기·사용 시작)만 브랜드 파랑, 나머지는 회색 알약 — 파랑은 한 카드에 한 번.
 */
export function MachineCard({ r, ticket, deviceId, onChanged }: { r: Resource; ticket?: MyTicket; deviceId: string; onChanged: () => void }) {
  const t = useT();
  const L = useL();
  const D = useD();
  const lang = useLang();
  const user = useAuth();   // 줄 서기는 로그인한 사용자만 (호출 알림을 받을 사람을 특정하기 위해)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setMsg(null);
    try { await fn(); onChanged(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  // 상태 문장을 서버 문장(state_label) 대신 숫자로 직접 만들어 두 언어 모두 지원 (규칙은 server/app/logic/laundry.py display_info 와 같음)
  const stateLabel =
    r.state === "in_use"
      ? r.overdue ? L("동작 중 (예상 시간 초과, 센서 기준)", "Running (past estimate, per sensor)")
        : r.remaining_min == null ? L("사용 중", "In use")
        : r.remaining_min === 0 ? L("곧 종료 예상 (1분 이내)", "Ending soon (under 1 min)")
        : L(`약 ${r.remaining_min}분 후 종료 예상`, `Ends in ~${r.remaining_min} min (est.)`)
      : r.state === "unknown" ? L("상태 불명 (센서 신호 없음)", "Unknown (no sensor signal)")
      : L("사용 가능", "Available");
  const stateText = r.state === "available" ? t("laundry.available") : r.state === "in_use" ? t("laundry.in_use") : t("laundry.unknown");
  const stateColor = r.state === "available" ? "text-up" : r.state === "in_use" ? "text-in-use" : "text-muted";

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted">{r.machine_type === "dryer" ? L("건조기", "Dryer") : L("세탁기", "Washer")}</p>
          <h3 className="font-display text-lg text-ink">{D(r.name)}</h3>
        </div>
        <span className={`pill bg-surface-strong px-3 py-1 text-xs font-semibold ${stateColor}`}>{stateText}</span>
      </div>

      <p className="mt-3 font-display text-xl text-ink">{stateLabel}</p>
      {r.state === "in_use" && r.expected_end_at && !r.overdue && (
        <p className="mt-1 text-xs text-muted">{L(`예상 종료 ${timeText(r.expected_end_at, lang)} · 추정값이며 실제 종료는 센서로 판정`, `Est. end ${timeText(r.expected_end_at, lang)} · an estimate; the sensor decides the real end`)}</p>
      )}
      {r.avg_cycle_min != null && <p className="text-xs text-muted">{L(`이 기기 최근 평균 소요 ${r.avg_cycle_min}분`, `Recent average cycle ${r.avg_cycle_min} min`)}</p>}
      <p className="text-xs text-muted-soft">{L("센서 수신", "Sensor")} {r.last_sample_at ? agoText(r.last_sample_at, lang) : L("없음", "none")} · {t("laundry.waiting")} {r.queue_length ?? 0}{t("people.unit")}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!ticket && user && (
          <button disabled={busy} onClick={() => run(() => api.joinQueue(r.id, deviceId, user.token))}
            className="pill h-11 bg-primary px-5 text-sm font-semibold text-white active:bg-primary-active disabled:bg-primary-disabled">
            {t("laundry.join")}
          </button>
        )}
        {!ticket && !user && (
          <Link href="/login" className="pill inline-flex h-11 items-center bg-surface-strong px-5 text-sm font-semibold text-primary">
            {L("로그인 후 줄 서기", "Log in to join")}
          </Link>
        )}
        {ticket?.status === "waiting" && (
          <>
            <span className="pill h-11 inline-flex items-center bg-surface-strong px-4 text-sm text-ink">{L(`내 순번 ${ticket.position}번 · 앞에 ${ticket.people_ahead}명`, `You are #${ticket.position} · ${ticket.people_ahead} ahead`)}</span>
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
      {r.state === "unknown" && <p className="mt-2 text-xs text-warn">{L("센서 신호가 없어 이 기기는 자동 호출되지 않습니다.", "No sensor signal, so this machine will not call the queue automatically.")}</p>}
      {msg && <p className="mt-2 text-xs text-down">{D(msg)}</p>}
    </div>
  );
}
