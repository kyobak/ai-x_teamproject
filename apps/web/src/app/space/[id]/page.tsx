"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { LevelBadge } from "@/components/LevelBadge";
import { ReportButtons } from "@/components/ReportButtons";
import { SourceNote } from "@/components/SourceNote";
import { api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

/** 오픈스페이스 2단계: 한 건물의 재실 인원·혼잡도 + 내 입실/퇴실 토글. */
export default function SpaceDetail() {
  const { id } = useParams<{ id: string }>();
  const { resources, deviceId } = useRealtime();
  const r = resources[id];
  const [inside, setInside] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (deviceId) api.checkinMe(id, deviceId).then((d) => setInside(d.checked_in)).catch(() => {}); }, [id, deviceId]);
  const toggle = async () => { setBusy(true); try { const d = await api.checkinToggle(id, deviceId); setInside(d.state === "checked_in"); } finally { setBusy(false); } };
  if (!r) return (<><Header title="오픈스페이스" back="/space" /><p className="p-4 text-sm text-muted">불러오는 중…</p></>);
  const ratio = r.capacity && r.occupancy_count != null ? Math.min(1, r.occupancy_count / r.capacity) : 0;
  return (
    <>
      <Header title={r.name} back="/space" />
      <main className="space-y-4 p-4">
        <section className="card p-6">
          <p className="text-xs text-muted">{r.zone}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="font-display text-5xl tabular-nums text-ink">{r.occupancy_count ?? "—"}<span className="text-xl text-muted"> / {r.capacity ?? "—"}</span></p>
            <LevelBadge level={r.level} size="lg" />
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-hairline-soft"><div className={`h-full ${ratio < 0.5 ? "bg-up" : ratio < 0.85 ? "bg-warn" : "bg-down"}`} style={{ width: `${ratio * 100}%` }} /></div>
          <p className="mt-1 text-xs text-muted">잔여 {r.capacity && r.occupancy_count != null ? Math.max(0, r.capacity - r.occupancy_count) : "—"}석 · 정원은 현장 확인 전 추정치</p>
          <div className="mt-3"><SourceNote source={r.source} note={r.note} seenAt={r.vision_seen_at} /></div>
        </section>
        <section className="card p-6 text-center">
          <p className="text-sm text-body">여기 계신가요? 체크인하면 재실 인원에 반영됩니다 (학번 저장 없음)</p>
          <button disabled={busy || inside == null} onClick={toggle}
            className={`pill mt-4 h-14 w-full text-base font-semibold ${inside ? "bg-surface-strong text-ink" : "bg-primary text-white active:bg-primary-active"} disabled:opacity-50`}>
            {inside == null ? "확인 중…" : inside ? "퇴실하기" : "입실 체크인"}
          </button>
          <p className="mt-2 text-[11px] text-muted-soft">입구 QR: <Link href="/admin" className="text-primary">관리 화면에서 출력</Link> · 퇴실을 안 찍으면 4시간 뒤 자동 퇴실</p>
        </section>
        <section className="card p-6"><ReportButtons resourceId={r.id} deviceId={deviceId} /></section>
      </main>
    </>
  );
}
