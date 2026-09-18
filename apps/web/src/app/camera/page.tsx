"use client";
import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { apiBase } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

/**
 * "휴대폰을 카메라 장비로": 노트북·라즈베리파이 없이 휴대폰 카메라만으로 줄 인원·재실 인원을 셉니다.
 *
 * 원리 (vision/run_video.py 의 브라우저판):
 *  - TensorFlow.js + COCO-SSD(lite_mobilenet_v2) 를 CDN 에서 불러와 휴대폰 안에서 사람을 검출합니다. 영상은 휴대폰 밖으로 나가지 않습니다 (REQ-VIS-01).
 *  - 화면의 지정 구역(위·아래 경계) 안에 발 위치(박스 아래 중앙)가 있는 사람만 셉니다. 10초 이동 중앙값으로 평활화.
 *  - 추적기가 없어 통과선 처리율은 못 세므로 throughput 은 null 로 보냅니다 → 서버가 시간대 평균 상수를 씁니다 (REQ-VIS-05, 화면에 "추정" 표시).
 *  - 10초마다 {resource_id, people_count, confidence} 만 POST.
 *
 * 정확도는 YOLO 보다 낮습니다(경량 모델, 2~5 fps). 시연·간이 측정용이며, 본 측정은 vision/run_video.py 를 씁니다.
 */
type Detection = { bbox: [number, number, number, number]; class: string; score: number };
type Model = { detect: (v: HTMLVideoElement) => Promise<Detection[]> };
type W = Window & { cocoSsd?: { load: (o: { base: string }) => Promise<Model> } };

function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script"); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error("스크립트 로드 실패: " + src));
    document.head.appendChild(s);
  });
}

export default function CameraPage() {
  const { list } = useRealtime();
  const targets = list.filter((r) => ["cafeteria", "shuttle", "space"].includes(r.kind));
  const [resource, setResource] = useState("cafeteria-1");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("대기");
  const [running, setRunning] = useState(false);
  const [top, setTop] = useState(30);      // 구역 위 경계 (%)
  const [bottom, setBottom] = useState(100);
  const [count, setCount] = useState(0);
  const [smoothed, setSmoothed] = useState(0);
  const [last, setLast] = useState<{ n: number; ok: boolean; at: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<Model | null>(null);
  const countsRef = useRef<{ t: number; c: number }[]>([]);
  const confRef = useRef<number[]>([]);
  const zoneRef = useRef({ top, bottom });
  useEffect(() => { zoneRef.current = { top, bottom }; }, [top, bottom]);

  useEffect(() => {
    if (!running) return;
    let alive = true;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      try {
        setStatus("모델 내려받는 중 (처음 한 번, 약 6MB)…");
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
        await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js");
        modelRef.current = await (window as W).cocoSsd!.load({ base: "lite_mobilenet_v2" });
        setStatus("카메라 여는 중…");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 640 } }, audio: false });
        const v = videoRef.current!; v.srcObject = stream; await v.play();
        setStatus("측정 중");
        const kind = list.find((r) => r.id === resource)?.kind;
        const zoneType = kind === "space" ? "room" : "queue";
        // 검출 루프: 한 프레임 끝나면 다음 프레임 (휴대폰 성능에 맞춰 자연스럽게 2~5 fps)
        const loop = async () => {
          if (!alive) return;
          const det = await modelRef.current!.detect(v);
          const cv = canvasRef.current!, ctx = cv.getContext("2d")!;
          cv.width = v.videoWidth; cv.height = v.videoHeight;
          ctx.clearRect(0, 0, cv.width, cv.height);
          const z = zoneRef.current, y0 = cv.height * z.top / 100, y1 = cv.height * z.bottom / 100;
          ctx.strokeStyle = "#05b169"; ctx.lineWidth = 3; ctx.strokeRect(2, y0, cv.width - 4, y1 - y0);
          let n = 0;
          for (const d of det) {
            if (d.class !== "person" || d.score < 0.4) continue;
            const [x, y, w, h] = d.bbox; const footY = y + h;
            const inside = footY >= y0 && footY <= y1;
            if (inside) { n++; confRef.current.push(d.score); if (confRef.current.length > 50) confRef.current.shift(); }
            ctx.strokeStyle = inside ? "#0052ff" : "#a8acb3"; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
          }
          const now = performance.now() / 1000;
          countsRef.current.push({ t: now, c: n });
          countsRef.current = countsRef.current.filter((p) => now - p.t <= 10);
          const sorted = countsRef.current.map((p) => p.c).sort((a, b) => a - b);
          const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : n;
          setCount(n); setSmoothed(med);
          requestAnimationFrame(() => setTimeout(loop, 150));
        };
        loop();
        timer = setInterval(async () => {
          const sorted = countsRef.current.map((p) => p.c).sort((a, b) => a - b);
          const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
          const conf = confRef.current.length ? confRef.current.reduce((a, b) => a + b, 0) / confRef.current.length : 0;
          try {
            const res = await fetch(`${apiBase()}/api/vision/metrics`, { method: "POST", headers: { "Content-Type": "application/json", "X-Device-Key": key },
              body: JSON.stringify({ resource_id: resource, people_count: med, throughput_per_min: null, confidence: Number(conf.toFixed(3)), device_id: "phone-camera", zone_type: zoneType }) });
            setLast({ n: med, ok: res.ok, at: new Date().toLocaleTimeString("ko-KR") });
          } catch { setLast({ n: med, ok: false, at: new Date().toLocaleTimeString("ko-KR") }); }
        }, 10000);
      } catch (e) { setStatus("오류: " + (e as Error).message); setRunning(false); }
    })();
    return () => { alive = false; if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  // resource/key 는 시작 시점 값을 쓰므로 의존성에서 제외 (측정 중 바꾸면 중지 후 재시작)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return (
    <>
      <Header title="휴대폰 카메라로 측정" back="/cafeteria" />
      <main className="space-y-4 p-4">
        <ol className="list-decimal space-y-1 rounded-[24px] bg-surface-soft p-4 pl-8 text-xs text-body">
          <li>측정할 장소와 기기 키(EDGE_API_KEY)를 넣고 시작을 누릅니다. 카메라 권한을 허용하세요.</li>
          <li>휴대폰을 줄이 보이는 높은 곳(2m 이상, 내려다보는 각도)에 거치합니다. 얼굴이 크게 잡히지 않는 각도가 좋습니다.</li>
          <li>초록 테두리(구역) 안에 줄이 들어오도록 위·아래 경계를 조절합니다. 파란 박스 = 구역 안에서 센 사람.</li>
          <li>영상은 휴대폰 밖으로 나가지 않고, 10초마다 인원 숫자만 서버로 보냅니다. 처리율은 시간대 평균값으로 대체됩니다.</li>
        </ol>
        <section className="card space-y-3 p-5">
          <label className="block text-sm"><span className="text-muted">측정 장소</span>
            <select value={resource} onChange={(e) => setResource(e.target.value)} disabled={running} className="mt-1 w-full rounded-xl border border-hairline bg-canvas px-3 py-2">
              {targets.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.kind === "space" ? "재실 인원" : "대기줄"})</option>)}
            </select></label>
          <label className="block text-sm"><span className="text-muted">기기 키 (배포 서버: Render Environment 의 EDGE_API_KEY)</span>
            <input value={key} onChange={(e) => setKey(e.target.value)} disabled={running} className="mt-1 w-full rounded-xl border border-hairline bg-canvas px-3 py-2 font-mono" placeholder="예: team09-edge-2026" /></label>
          {!running ? (
            <button onClick={() => setRunning(true)} disabled={!key} className="pill h-12 w-full bg-primary font-semibold text-white disabled:bg-primary-disabled">카메라 시작</button>
          ) : (
            <button onClick={() => { setRunning(false); setStatus("중지됨"); }} className="pill h-12 w-full bg-surface-strong font-semibold text-ink">중지</button>
          )}
          <p className="text-xs text-muted">{status}</p>
        </section>
        <section className="card overflow-hidden p-0">
          <div className="relative bg-black">
            <video ref={videoRef} playsInline muted className="block w-full" />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 text-center">
            <div className="rounded-2xl bg-surface-soft p-3"><p className="font-display text-3xl tabular-nums">{count}</p><p className="text-[11px] text-muted">지금 프레임</p></div>
            <div className="rounded-2xl bg-surface-soft p-3"><p className="font-display text-3xl tabular-nums text-primary">{smoothed}</p><p className="text-[11px] text-muted">10초 중앙값 (전송값)</p></div>
          </div>
          <div className="space-y-2 px-4 pb-4 text-xs text-body">
            <label className="flex items-center gap-2">위 경계 {top}%<input type="range" min={0} max={90} value={top} onChange={(e) => setTop(Math.min(Number(e.target.value), bottom - 10))} className="flex-1 accent-primary" /></label>
            <label className="flex items-center gap-2">아래 경계 {bottom}%<input type="range" min={10} max={100} value={bottom} onChange={(e) => setBottom(Math.max(Number(e.target.value), top + 10))} className="flex-1 accent-primary" /></label>
            {last && <p className="text-muted">마지막 전송 {last.at} · {last.n}명 · {last.ok ? "서버 수신 OK" : "전송 실패 (기기 키·네트워크 확인)"}</p>}
          </div>
        </section>
      </main>
    </>
  );
}
