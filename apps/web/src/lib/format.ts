/** 화면 표시용 작은 도우미들. */
import type { Level } from "./api";

export const LEVEL_STYLE: Record<Level, { text: string; bg: string; fg: string; dot: string }> = {
  relaxed: { text: "여유", bg: "bg-emerald-50", fg: "text-emerald-700", dot: "bg-emerald-500" },
  normal: { text: "보통", bg: "bg-amber-50", fg: "text-amber-700", dot: "bg-amber-500" },
  crowded: { text: "혼잡", bg: "bg-rose-50", fg: "text-rose-700", dot: "bg-rose-500" },
  unknown: { text: "알 수 없음", bg: "bg-slate-100", fg: "text-slate-500", dot: "bg-slate-400" },
};

/** 데이터 출처 → 사용자에게 보여줄 짧은 라벨. 추정값을 실측처럼 보이게 하지 않는 것이 목적(REQ-VIS-03, REQ-LAU-06). */
export const SOURCE_LABEL: Record<string, string> = {
  vision: "카메라 실측",
  "vision-fallback-throughput": "카메라 인원 + 처리율 추정",
  report: "사용자 제보",
  prediction: "시간대 예측",
  admin: "관리자 입력",
  none: "데이터 없음",
};

export function waitText(min: number | null | undefined): string {
  if (min == null) return "—";
  if (min >= 999) return "측정 불가";
  if (min < 1) return "바로 이용";
  return `약 ${Math.round(min)}분`;
}

export function agoText(iso: string | null | undefined): string {
  if (!iso) return "";
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${Math.round(sec)}초 전`;
  if (sec < 3600) return `${Math.round(sec / 60)}분 전`;
  return `${Math.round(sec / 3600)}시간 전`;
}

export function timeText(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}
