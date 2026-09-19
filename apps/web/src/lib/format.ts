/** 화면 표시용 작은 도우미들. 색은 "글자색만" 씁니다(디자인 가이드: 의미색을 배경으로 칠하지 않음). */
import type { Level } from "./api";

export const LEVEL_STYLE: Record<Level, { key: string; fg: string; dot: string }> = {
  relaxed: { key: "level.relaxed", fg: "text-up", dot: "bg-up" },
  normal: { key: "level.normal", fg: "text-warn", dot: "bg-warn" },
  crowded: { key: "level.crowded", fg: "text-down", dot: "bg-down" },
  unknown: { key: "level.unknown", fg: "text-muted", dot: "bg-muted-soft" },
};

/** 데이터 출처 → 사용자에게 보여줄 짧은 라벨. 추정값을 실측처럼 보이게 하지 않는 것이 목적(REQ-VIS-03, REQ-LAU-06). */
export const SOURCE_LABEL: Record<string, { ko: string; en: string }> = {
  vision: { ko: "카메라 실측", en: "Camera" },
  "vision-fallback-throughput": { ko: "카메라 인원 + 처리율 추정", en: "Camera count + estimated rate" },
  report: { ko: "사용자 제보", en: "User reports" },
  prediction: { ko: "시간대 예측", en: "Time-slot forecast" },
  admin: { ko: "관리자 입력", en: "Admin input" },
  qr: { ko: "QR 체크인", en: "QR check-in" },
  sensor: { ko: "진동 센서 실측", en: "Vibration sensor" },
  demo: { ko: "시연용 시뮬레이션", en: "Demo simulation" },
  none: { ko: "데이터 없음", en: "No data" },
};

export type Lang = "ko" | "en";

export function sourceLabel(source: string | undefined, lang: Lang = "ko"): string {
  const e = SOURCE_LABEL[source ?? "none"];
  return e ? e[lang] : (source ?? "");
}

/** 예상 대기(분) → "약 5분" / "about 5 min" */
export function waitText(min: number | null | undefined, lang: Lang = "ko"): string {
  if (min == null) return "—";
  if (min >= 999) return lang === "en" ? "N/A" : "측정 불가";
  if (min < 1) return lang === "en" ? "No wait" : "바로 이용";
  return lang === "en" ? `~${Math.round(min)} min` : `약 ${Math.round(min)}분`;
}

/** ISO 시각 → "12초 전" / "12s ago" */
export function agoText(iso: string | null | undefined, lang: Lang = "ko"): string {
  if (!iso) return "";
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return lang === "en" ? `${Math.round(sec)}s ago` : `${Math.round(sec)}초 전`;
  if (sec < 3600) return lang === "en" ? `${Math.round(sec / 60)} min ago` : `${Math.round(sec / 60)}분 전`;
  return lang === "en" ? `${Math.round(sec / 3600)} h ago` : `${Math.round(sec / 3600)}시간 전`;
}

/** ISO 시각 → "오후 10:26" / "10:26 PM" */
export function timeText(iso: string | null | undefined, lang: Lang = "ko"): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(lang === "en" ? "en-US" : "ko-KR", { hour: "2-digit", minute: "2-digit" });
}

/** 분 → "7분" / "7 min" (0 이면 "지금"/"now") */
export function minText(min: number | null | undefined, lang: Lang = "ko"): string {
  if (min == null) return "—";
  if (min === 0) return lang === "en" ? "Now" : "지금";
  return lang === "en" ? `${min} min` : `${min}분`;
}

/** 셔틀 탑승 안내 문장. 서버의 board_note 대신 숫자로 두 언어를 만듭니다 (규칙은 server/app/logic/shuttle.py boarding 과 같음). */
export function boardNote(r: { board_time?: string | null; buses_to_wait?: number | null; people_count?: number | null; upcoming?: unknown[] }, lang: Lang = "ko"): string {
  const en = lang === "en";
  if (!r.upcoming || r.upcoming.length === 0) return en ? "No more buses today" : "오늘 운행 종료";
  if (r.people_count == null) return en ? "No queue data · based on the next bus" : "줄 인원 정보 없음 · 다음 차 기준";
  if (r.board_time == null) return en ? "Hard to board with today's remaining buses" : "오늘 남은 운행으로는 탑승 어려움";
  if (!r.buses_to_wait) return en ? "You can board the next bus" : "다음 차 탑승 가능";
  return en ? `${r.people_count} ahead fill ${r.buses_to_wait} bus(es)` : `앞 ${r.people_count}명이 ${r.buses_to_wait}대를 채움`;
}
