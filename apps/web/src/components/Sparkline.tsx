/** 의존성 없이 SVG 로 그리는 미니 선 그래프. 선은 브랜드 파랑 하나. */
export function Sparkline({ values, height = 48, color = "#0052ff", emptyText = "데이터가 더 쌓이면 그래프가 표시됩니다", label = "최근 추이" }: { values: number[]; height?: number; color?: string; emptyText?: string; label?: string }) {
  if (values.length < 2) return <div className="text-xs text-muted-soft">{emptyText}</div>;
  const w = 300, max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - ((v - min) / (max - min || 1)) * (height - 4) - 2}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-12 w-full" preserveAspectRatio="none" aria-label={label}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
