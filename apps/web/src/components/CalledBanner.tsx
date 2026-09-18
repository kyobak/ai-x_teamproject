"use client";
import Link from "next/link";
import { useRealtime } from "@/lib/realtime";

/** 호출된 티켓이 있으면 모든 페이지 상단에 띄우는 배너. 푸시 알림이 막힌 iOS 를 위한 대체 경로(리스크 표 'iOS 푸시 제약'). */
export function CalledBanner() {
  const { myTickets } = useRealtime();
  const called = myTickets.filter((t) => t.status === "called");
  if (called.length === 0) return null;
  return (
    <Link href="/laundry" className="block bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white">
      {called.map((t) => t.name).join(", ")} 이(가) 비었습니다 · 5분 안에 사용을 시작하세요 →
    </Link>
  );
}
