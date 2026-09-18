"use client";
import type { Level } from "@/lib/api";
import { LEVEL_STYLE } from "@/lib/format";
import { useT } from "@/lib/i18n";

/** 여유/보통/혼잡 배지. 가이드대로 배경은 중립 회색(surface-strong), 의미색은 점과 글자에만. 색맹 대비를 위해 글자를 항상 같이. */
export function LevelBadge({ level, size = "md" }: { level: Level | undefined; size?: "sm" | "md" | "lg" }) {
  const t = useT();
  const s = LEVEL_STYLE[level ?? "unknown"];
  const cls = size === "lg" ? "px-3.5 py-1.5 text-sm" : size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 pill bg-surface-strong font-semibold ${s.fg} ${cls}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
      {t(s.key)}
    </span>
  );
}
