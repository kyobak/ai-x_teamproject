"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Header } from "@/components/Header";
import { LevelBadge } from "@/components/LevelBadge";
import { ReportButtons } from "@/components/ReportButtons";
import { SourceNote } from "@/components/SourceNote";
import { useRealtime } from "@/lib/realtime";
import { useD, useL } from "@/lib/i18n";

/**
 * 오픈스페이스 2단계: 재실 인원·수용 인원·혼잡도. 인원은 천장/벽 카메라가 앉은 사람까지 세어 숫자만 보냅니다.
 * (QR 체크인은 학생이 찍어야 데이터가 생겨 공백이 커서 카메라 센싱으로 바꿈)
 */
export default function SpaceDetail() {
  const { id } = useParams<{ id: string }>();
  const { resources, deviceId } = useRealtime();
  const L = useL();
  const D = useD();
  const r = resources[id];
  if (!r) return (<><Header title={L("오픈스페이스", "Open space")} back="/space" /><p className="p-4 text-sm text-muted">{L("불러오는 중…", "Loading…")}</p></>);
  const ratio = r.capacity && r.occupancy_count != null ? Math.min(1, r.occupancy_count / r.capacity) : 0;
  const left = r.capacity && r.occupancy_count != null ? Math.max(0, r.capacity - r.occupancy_count) : null;
  return (
    <>
      <Header title={`${D(r.zone)} ${D(r.name)}`} back="/space" />
      <main className="space-y-4 p-4">
        <section className="card p-6">
          <p className="text-xs text-muted">{D(r.zone)} · {L(`수용 약 ${r.capacity}명`, `Capacity ~${r.capacity}`)}{r.space_note ? ` (${D(r.space_note)})` : ""}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className="font-display text-5xl tabular-nums text-ink">{r.occupancy_count ?? "—"}<span className="text-xl text-muted"> / {r.capacity ?? "—"}</span></p>
            <LevelBadge level={r.level} size="lg" />
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-hairline-soft"><div className={`h-full ${ratio < 0.5 ? "bg-up" : ratio < 0.85 ? "bg-warn" : "bg-down"}`} style={{ width: `${ratio * 100}%` }} /></div>
          <p className="mt-1 text-xs text-muted">{L(`남은 자리 약 ${left ?? "—"}석`, `~${left ?? "—"} seats left`)}</p>
          <div className="mt-3"><SourceNote source={r.source} note={r.note} seenAt={r.vision_seen_at} /></div>
        </section>
        <section className="rounded-[24px] bg-surface-soft p-5 text-xs text-body">
          <p className="font-display text-sm text-ink">{L("어떻게 세나요?", "How is it counted?")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>{L("공간을 내려다보는 카메라가 사람을 찾고, 몸 중심이 공간 안에 있으면 셉니다. 책상에 앉아 발이 가려진 사람도 셉니다.", "A camera looking down finds people and counts anyone whose body center is inside the space, including people seated at desks.")}</li>
            <li>{L("영상은 저장·전송하지 않고, 인원 숫자만 10초마다 서버로 보냅니다.", "No video is stored or sent; only the head count goes to the server every 10 seconds.")}</li>
            <li>{L("수용 인원 대비 50% 미만 여유, 85% 미만 보통, 그 이상 혼잡입니다.", "Under 50% of capacity is light, under 85% is moderate, above that is busy.")}</li>
          </ul>
          <Link href={`/camera?resource=${r.id}`} className="pill mt-3 inline-block bg-primary px-4 py-2 text-xs font-semibold text-white">{L("휴대폰 카메라로 이 공간 측정하기", "Measure this space with your phone camera")}</Link>
        </section>
        <section className="card p-6"><ReportButtons resourceId={r.id} deviceId={deviceId} /></section>
      </main>
    </>
  );
}
