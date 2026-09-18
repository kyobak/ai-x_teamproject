"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";

/** 혼잡도 제보. 10분에 한 번만 받으며(REQ-RPT-01), 거부되면 재제보 가능 시각을 보여줍니다. 버튼은 회색 알약 + 의미색 글자. */
const OPTIONS = [
  { level: 1, key: "level.relaxed", fg: "text-up" },
  { level: 3, key: "level.normal", fg: "text-warn" },
  { level: 5, key: "level.crowded", fg: "text-down" },
];

export function ReportButtons({ resourceId, deviceId }: { resourceId: string; deviceId: string }) {
  const t = useT();
  const [msg, setMsg] = useState<string | null>(null);
  const send = async (level: number) => {
    setMsg(null);
    try {
      await api.report(resourceId, level, deviceId);
      setMsg("제보 감사합니다. 30분 동안 반영됩니다.");
    } catch (e) {
      try {
        const d = JSON.parse((e as Error).message) as { message: string; retry_at: string };
        setMsg(`${d.message} (${new Date(d.retry_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 이후 가능)`);
      } catch { setMsg((e as Error).message); }
    }
  };
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink">{t("report.q")}</p>
      <div className="flex gap-2">
        {OPTIONS.map((o) => (
          <button key={o.level} onClick={() => send(o.level)} className={`pill h-11 flex-1 bg-surface-strong text-sm font-semibold ${o.fg} active:bg-hairline`}>{t(o.key)}</button>
        ))}
      </div>
      {msg && <p className="mt-2 text-xs text-body">{msg}</p>}
    </div>
  );
}
