"use client";
import Link from "next/link";
import { Header } from "@/components/Header";
import { ResourceCard } from "@/components/ResourceCard";
import { useL, useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/** 학식 1단계: 구내식당·푸드코트 목록, 대기 짧은 순. */
export default function CafeteriaHub() {
  const { list } = useRealtime();
  const t = useT();
  const L = useL();
  const cafes = list.filter((r) => r.kind === "cafeteria").sort((a, b) => (a.est_wait_min ?? 99) - (b.est_wait_min ?? 99));
  return (
    <>
      <Header title={t("hub.cafeteria")} back="/" />
      <main className="space-y-3 p-4">
        <p className="text-xs text-muted">{L("예상 대기 = 줄 인원 ÷ 분당 처리 인원. 메뉴·운영시간은 ERICA 복지포털 기준.", "Estimated wait = people in line ÷ served per minute. Menus and hours from the ERICA welfare portal.")}</p>
        {cafes.map((r) => <ResourceCard key={r.id} r={r} />)}
        <Link href="/camera" className="card flex items-center justify-between p-4 text-sm">
          <span><span className="font-display text-ink">{L("휴대폰 카메라로 줄 인원 재기", "Count a line with your phone camera")}</span><span className="block text-xs text-muted">{L("노트북 없이 휴대폰 안에서 사람을 세어 숫자만 전송", "Counts people on the phone itself and sends only the number")}</span></span>
          <span className="text-xl text-muted-soft">›</span>
        </Link>
      </main>
    </>
  );
}
