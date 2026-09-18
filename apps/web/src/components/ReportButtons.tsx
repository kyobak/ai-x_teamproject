"use client";
import { useState } from "react";
import { api } from "@/lib/api";

/** 혼잡도 제보. 10분에 한 번만 받으며(REQ-RPT-01), 거부되면 재제보 가능 시각을 보여줍니다. */
const OPTIONS = [
  { level: 1, label: "여유", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { level: 3, label: "보통", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  { level: 5, label: "혼잡", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
];

export function ReportButtons({ resourceId, deviceId }: { resourceId: string; deviceId: string }) {
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
      <p className="mb-2 text-sm font-medium text-slate-700">지금 현장은 어떤가요? (제보)</p>
      <div className="flex gap-2">
        {OPTIONS.map((o) => (
          <button key={o.level} onClick={() => send(o.level)} className={`flex-1 rounded-xl py-2 text-sm font-semibold ring-1 ${o.cls}`}>{o.label}</button>
        ))}
      </div>
      {msg && <p className="mt-2 text-xs text-slate-600">{msg}</p>}
    </div>
  );
}
