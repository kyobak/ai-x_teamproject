"use client";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { apiBase } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

/**
 * "휴대폰을 진동 센서로": 센서 모듈을 사기 전에 쓸 수 있는 공짜 대안.
 * 안 쓰는 스마트폰을 세탁기 옆면에 테이프로 붙이고 이 화면을 열어 두면, 가속도계(DeviceMotion)로
 * 진동 세기(|a| - 1g)를 10초 평균 내어 서버에 보냅니다. ESP32 펌웨어와 완전히 같은 형식이라 서버는 구분하지 못합니다.
 * iOS 는 사용자가 버튼을 눌러 권한을 줘야 하고(HTTPS 필요), Android Chrome 은 바로 동작합니다.
 */
export default function SensorPage() {
  const { list } = useRealtime();
  const machines = list.filter((r) => r.kind === "laundry");
  const [resource, setResource] = useState("laundry-changui-w1");
  const [key, setKey] = useState("dev-edge-key");
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<{ mag: number; ok: boolean } | null>(null);
  const [live, setLive] = useState(0);
  const acc = useRef<number[]>([]);

  useEffect(() => {
    if (!running) return;
    const onMotion = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null || g.y == null || g.z == null) return;
      const mag = Math.abs(Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) / 9.81 - 1);  // 중력 1g 를 뺀 진동 성분
      acc.current.push(mag);
      setLive(mag);
    };
    window.addEventListener("devicemotion", onMotion);
    const timer = setInterval(async () => {
      const arr = acc.current; acc.current = [];
      const mean = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      try {
        const res = await fetch(`${apiBase()}/api/sensors/vibration`, { method: "POST", headers: { "Content-Type": "application/json", "X-Device-Key": key }, body: JSON.stringify({ resource_id: resource, magnitude: Number(mean.toFixed(3)) }) });
        setLast({ mag: mean, ok: res.ok });
      } catch { setLast({ mag: mean, ok: false }); }
    }, 10000);
    return () => { window.removeEventListener("devicemotion", onMotion); clearInterval(timer); };
  }, [running, resource, key]);

  const start = async () => {
    // iOS 13+ 는 명시적 권한 요청이 필요 (사용자 제스처 안에서만 호출 가능)
    const DM = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DM.requestPermission === "function") {
      const p = await DM.requestPermission();
      if (p !== "granted") { alert("동작 센서 권한이 필요합니다"); return; }
    }
    setRunning(true);
  };

  return (
    <>
      <Header title="휴대폰 진동 센서" back="/admin" />
      <main className="space-y-4 p-4">
        <p className="rounded-[24px] bg-surface-soft p-4 text-xs text-body">안 쓰는 휴대폰을 세탁기 옆면 위쪽에 테이프로 붙이고 이 화면을 켜 두세요. 10초마다 진동 세기를 서버에 보냅니다. 화면이 꺼지면 멈추므로 화면 자동 잠금을 꺼 두세요.</p>
        <section className="card space-y-3 p-6">
          <label className="block text-sm"><span className="text-muted">기기</span>
            <select value={resource} onChange={(e) => setResource(e.target.value)} className="mt-1 w-full rounded-xl border border-hairline bg-canvas px-3 py-2">
              {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select></label>
          <label className="block text-sm"><span className="text-muted">기기 키 (server/.env 의 EDGE_API_KEY)</span>
            <input value={key} onChange={(e) => setKey(e.target.value)} className="mt-1 w-full rounded-xl border border-hairline bg-canvas px-3 py-2 font-mono" /></label>
          {!running ? (
            <button onClick={start} className="pill h-12 w-full bg-primary font-semibold text-white">센서 시작</button>
          ) : (
            <button onClick={() => setRunning(false)} className="pill h-12 w-full bg-surface-strong font-semibold text-ink">중지</button>
          )}
          <div className="rounded-2xl bg-surface-soft p-4 text-center">
            <p className="text-xs text-muted">지금 진동 (g)</p>
            <p className="font-display text-4xl tabular-nums">{live.toFixed(3)}</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-hairline"><div className="h-full bg-primary" style={{ width: `${Math.min(100, live * 200)}%` }} /></div>
            {last && <p className="mt-2 text-xs text-muted">마지막 전송 평균 {last.mag.toFixed(3)} g · {last.ok ? "서버 수신 OK" : "전송 실패"}</p>}
          </div>
        </section>
      </main>
    </>
  );
}
