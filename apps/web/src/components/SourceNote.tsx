import { SOURCE_LABEL, agoText } from "@/lib/format";

/** "이 숫자가 어디서 왔는지" 를 항상 같이 보여줍니다. 카메라 신호가 끊겨 제보/예측으로 대체되면 여기서 드러납니다 (REQ-VIS-03). */
export function SourceNote({ source, note, seenAt }: { source?: string; note?: string; seenAt?: string | null }) {
  const isMeasured = source === "vision" || source === "qr";
  const label = SOURCE_LABEL[source ?? "none"] ?? source;
  return (
    <p className={`text-xs ${isMeasured ? "text-muted" : "text-warn"}`} title={note}>
      {isMeasured ? "●" : "◐"} {label}
      {seenAt && isMeasured ? ` · ${agoText(seenAt)}` : ""}
      {!isMeasured && note && note !== label ? ` · ${note}` : ""}
    </p>
  );
}
