import type { Level } from "@/lib/api";
import { LEVEL_STYLE } from "@/lib/format";

/** 여유/보통/혼잡 알약 배지. 색상만으로 구분되지 않도록 글자도 같이 보여줍니다(접근성). */
export function LevelBadge({ level, size = "md" }: { level: Level | undefined; size?: "sm" | "md" | "lg" }) {
  const s = LEVEL_STYLE[level ?? "unknown"];
  const cls = size === "lg" ? "px-3 py-1 text-base" : size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-0.5 text-sm";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${s.bg} ${s.fg} ${cls}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
      {s.text}
    </span>
  );
}
