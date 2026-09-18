"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { LevelBadge } from "@/components/LevelBadge";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

/**
 * 오픈스페이스 QR 체크인 화면 (Could). 입구 QR 을 찍으면 이 주소가 열립니다.
 * 버튼 하나로 입실/퇴실 토글. 학번 없이 익명 기기 ID 로만 셉니다.
 */
export default function CheckinPage() {
  const { id } = useParams<{ id: string }>();
  const { resources, deviceId } = useRealtime();
  const r = resources[id];
  const [inside, setInside] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (deviceId) api.checkinMe(id, deviceId).then((d) => setInside(d.checked_in)).catch(() => {}); }, [id, deviceId]);
  const toggle = async () => {
    setBusy(true);
    try { const d = await api.checkinToggle(id, deviceId); setInside(d.state === "checked_in"); } finally { setBusy(false); }
  };
  return (
    <>
      <Header title={r?.name ?? "체크인"} back="/" />
      <main className="space-y-4 p-4">
        <section className="card p-6 text-center">
          <p className="text-xs text-muted">{r?.zone}</p>
          <p className="mt-2 font-display text-5xl tabular-nums text-ink">{r?.occupancy_count ?? "—"}<span className="text-xl text-muted"> / {r?.capacity ?? "—"}</span></p>
          <p className="mt-1 text-sm text-body">현재 재실 인원 (QR 체크인 기준)</p>
          <div className="mt-3 flex justify-center"><LevelBadge level={r?.level} size="lg" /></div>
          <button disabled={busy || inside == null} onClick={toggle}
            className={`pill mt-6 h-14 w-full text-base font-semibold ${inside ? "bg-surface-strong text-ink" : "bg-primary text-white active:bg-primary-active"} disabled:opacity-50`}>
            {inside == null ? "확인 중…" : inside ? "퇴실하기" : "입실 체크인"}
          </button>
          <p className="mt-3 text-[11px] text-muted-soft">퇴실을 안 찍으면 4시간 뒤 자동 퇴실됩니다 · 학번은 저장하지 않습니다</p>
        </section>
      </main>
    </>
  );
}
