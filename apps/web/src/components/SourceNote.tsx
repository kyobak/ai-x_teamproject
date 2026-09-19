"use client";
import { agoText, sourceLabel } from "@/lib/format";
import { useD, useLang } from "@/lib/i18n";

/** "이 숫자가 어디서 왔는지" 를 항상 같이 보여줍니다. 카메라 신호가 끊겨 제보/예측으로 대체되면 여기서 드러납니다 (REQ-VIS-03). */
export function SourceNote({ source, note, seenAt }: { source?: string; note?: string; seenAt?: string | null }) {
  const lang = useLang();
  const D = useD();
  const isMeasured = source === "vision" || source === "qr" || source === "sensor";
  const label = sourceLabel(source, lang);
  const n = D(note);
  return (
    <p className={`text-xs ${isMeasured ? "text-muted" : "text-warn"}`} title={n}>
      {isMeasured ? "●" : "◐"} {label}
      {seenAt && isMeasured ? ` · ${agoText(seenAt, lang)}` : ""}
      {!isMeasured && n && n !== label ? ` · ${n}` : ""}
    </p>
  );
}
