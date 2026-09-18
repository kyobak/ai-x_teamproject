"use client";
import Link from "next/link";
import { Header } from "@/components/Header";
import { ResourceCard } from "@/components/ResourceCard";
import { useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/** 오픈스페이스 1단계: 건물 목록 (재실/정원). 여유 순으로 정렬. */
export default function SpaceHub() {
  const { list } = useRealtime();
  const t = useT();
  const spaces = list.filter((r) => r.kind === "space").sort((a, b) => ((a.occupancy_count ?? 0) / (a.capacity ?? 1)) - ((b.occupancy_count ?? 0) / (b.capacity ?? 1)));
  return (
    <>
      <Header title={t("hub.space")} back="/" />
      <main className="space-y-3 p-4">
        <p className="text-xs text-muted">여유 있는 곳부터 보여줍니다. 입구 QR 체크인 또는 카메라 인원 계수로 재실 인원을 셉니다.</p>
        {spaces.map((r) => <ResourceCard key={r.id} r={r} />)}
        <Link href="/camera" className="card flex items-center justify-between p-4 text-sm">
          <span><span className="font-display text-ink">휴대폰 카메라로 재실 인원 재기</span><span className="block text-xs text-muted">휴대폰 안에서 사람을 세어 숫자만 전송</span></span>
          <span className="text-xl text-muted-soft">›</span>
        </Link>
      </main>
    </>
  );
}
