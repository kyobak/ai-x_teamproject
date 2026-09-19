"use client";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { apiBase } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useD, useL } from "@/lib/i18n";

/**
 * "휴대폰을 진동 센서로": 센서 모듈을 사기 전에 쓸 수 있는 공짜 대안.
 * 안 쓰는 스마트폰을 세탁기 옆면에 테이프로 붙이고 이 화면을 열어 두면, 가속도계(DeviceMotion)로
 * 진동 세기(|a| - 1g)를 10초 평균 내어 서버에 보냅니다. ESP32 펌웨어와 완전히 같은 형식이라 서버는 구분하지 못합니다.
 * iOS 는 사용자가 버튼을 눌러 권한을 줘야 하고(HTTPS 필요), Android Chrome 은 바로 동작합니다.
 */
export default function SensorPage() {
  const { list } = useRealtime();
  const L = useL();
  const D = useD();
  const machines = list.filter((r) => r.kind === "laundry");
  const [resource, setResource] = useState("laundry-changui-w1");
  const [key, setKey] = useState("dev-edge-key");
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<{ mag: number; ok: boolean } | null>(null);
  const [live, setLive] = useState(0);
  const acc = useRef<number[]>([]);

  // 화면이 꺼지면 브라우저가 가속도 이벤트를 멈추므로, 측정 중엔 Wake Lock 으로 화면을 켜 둡니다 (지원 브라우저: Android Chrome, iOS 16.4+ Safari).
  useEffect(() => {
    if (!running) return;
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {});
    const onVisible = () => { if (document.visibilityState === "visible") nav.wakeLock?.request("screen").then((l) => { lock = l; }).catch(() => {}); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { document.removeEventListener("visibilitychange", onVisible); lock?.release().catch(() => {}); };
  }, [running]);

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
      if (p !== "granted") { alert(L("동작 센서 권한이 필요합니다", "Motion sensor permission is required")); return; }
    }
    setRunning(true);
  };

  return (
    <>
      <Header title={L("휴대폰 진동 센서", "Phone vibration sensor")} back="/admin" />
      <main className="space-y-4 p-4">
        <ol className="list-decimal space-y-1 rounded-[24px] bg-surface-soft p-4 pl-8 text-xs text-body">
          <li>{L("아래에서 기기를 고르고, 기기 키(관리자에게 받은 EDGE_API_KEY)를 넣습니다.", "Pick a machine below and enter the device key (EDGE_API_KEY from the admin).")}</li>
          <li>{L("센서 시작을 누릅니다. iPhone 은 동작 센서 권한 허용을 묻습니다.", "Tap start. iPhone will ask for motion sensor permission.")}</li>
          <li>{L("휴대폰을 세탁기·건조기 옆면 위쪽(문 쪽)에 테이프나 벨크로로 단단히 붙입니다. 진동 그래프가 흔들리면 정상입니다.", "Tape or velcro the phone firmly to the upper side (door side) of the machine. If the bar moves, it works.")}</li>
          <li>{L("이 화면을 그대로 둡니다. 측정 중엔 화면이 꺼지지 않게 잡아 두지만, 안전하게 화면 자동 잠금도 꺼 두세요. 10초마다 서버에 전송됩니다.", "Leave this screen open. It keeps the screen awake, but turn off auto-lock to be safe. Data is sent every 10 seconds.")}</li>
        </ol>
        <section className="card space-y-3 p-6">
          <label className="block text-sm"><span className="text-muted">{L("기기", "Machine")}</span>
            <select value={resource} onChange={(e) => setResource(e.target.value)} className="mt-1 w-full rounded-xl border border-hairline bg-canvas px-3 py-2">
              {machines.map((m) => <option key={m.id} value={m.id}>{D(m.zone)} {D(m.name)}</option>)}
            </select></label>
          <label className="block text-sm"><span className="text-muted">{L("기기 키 (server/.env 의 EDGE_API_KEY)", "Device key (EDGE_API_KEY in server/.env)")}</span>
            <input value={key} onChange={(e) => setKey(e.target.value)} className="mt-1 w-full rounded-xl border border-hairline bg-canvas px-3 py-2 font-mono" /></label>
          {!running ? (
            <button onClick={start} className="pill h-12 w-full bg-primary font-semibold text-white">{L("센서 시작", "Start sensor")}</button>
          ) : (
            <button onClick={() => setRunning(false)} className="pill h-12 w-full bg-surface-strong font-semibold text-ink">{L("중지", "Stop")}</button>
          )}
          <div className="rounded-2xl bg-surface-soft p-4 text-center">
            <p className="text-xs text-muted">{L("지금 진동 (g)", "Vibration now (g)")}</p>
            <p className="font-display text-4xl tabular-nums">{live.toFixed(3)}</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-hairline"><div className="h-full bg-primary" style={{ width: `${Math.min(100, live * 200)}%` }} /></div>
            {last && <p className="mt-2 text-xs text-muted">{L(`마지막 전송 평균 ${last.mag.toFixed(3)} g · `, `Last average sent ${last.mag.toFixed(3)} g · `)}{last.ok ? L("서버 수신 OK", "received") : L("전송 실패 (기기 키·네트워크 확인)", "send failed (check key/network)")}</p>}
            <p className="mt-1 text-[11px] text-muted-soft">{L("판정 기준: 0.15 g 초과가 30초 이어지면 사용 중, 무진동 5분이면 종료 (서버 설정값)", "Rule: over 0.15 g for 30 s means in use; 5 min without vibration means finished (server settings)")}</p>
          </div>
        </section>
      </main>
    </>
  );
}
