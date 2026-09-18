"use client";
import Link from "next/link";
import { useRealtime } from "@/lib/realtime";

/** 호출된 티켓이 있으면 모든 페이지 상단에 띄우는 배너(브랜드 파랑). 푸시가 막힌 iOS 를 위한 대체 경로. */
export function CalledBanner() {
  const { myTickets } = useRealtime();
  const called = myTickets.filter((t) => t.status === "called");
  if (called.length === 0) return null;
  return (
    <Link href="/laundry" className="block bg-primary px-4 py-2.5 text-center font-display text-sm text-white">
      {called.map((t) => t.name).join(", ")} 이(가) 비었습니다 · 5분 안에 사용을 시작하세요 →
    </Link>
  );
}
