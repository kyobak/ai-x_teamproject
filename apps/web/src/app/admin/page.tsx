"use client";
import { useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { api } from "@/lib/api";
import { clearPin, getPin, setPin } from "@/lib/admin";
import { useD, useL, useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/**
 * 관리자 화면: PIN 로그인 → 수동 입력 / 자원 등록·삭제 / 오픈스페이스 QR 출력 / 푸시 테스트.
 * PIN 은 server/.env 의 ADMIN_PIN (기본 0000). 프로토타입용 단순 인증이며 배포 전 로그인으로 교체.
 */
export default function AdminPage() {
  const { list, deviceId } = useRealtime();
  const t = useT();
  const L = useL();
  const D = useD();
  const [pin, setPinState] = useState<string>(() => (typeof window !== "undefined" ? getPin() : ""));
  const [pinInput, setPinInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ id: "", kind: "laundry", zone: "", name: "", capacity: "", source: "sensor" });

  const login = async () => {
    try { await api.adminLogin(pinInput); setPin(pinInput); setPinState(pinInput); setMsg(null); } catch { setMsg(L("PIN 이 틀립니다", "Wrong PIN")); }
  };
  const send = async (body: Parameters<typeof api.adminStatus>[0]) => {
    try { await api.adminStatus(body, pin); setMsg(L(`${body.resource_id} 반영됨`, `${body.resource_id} updated`)); } catch (e) { setMsg(D((e as Error).message)); }
  };
  const create = async () => {
    try {
      const extra = form.kind === "laundry" ? { type: "washer" } : {};
      await api.adminCreateResource({ ...form, capacity: form.capacity ? Number(form.capacity) : null, extra }, pin);
      setMsg(L(`${form.id} 등록됨`, `${form.id} registered`)); setForm({ ...form, id: "", name: "" });
    } catch (e) { setMsg((e as Error).message); }
  };
  const remove = async (id: string) => {
    if (!confirm(L(`${id} 자원을 삭제할까요?`, `Delete resource ${id}?`))) return;
    try { await api.adminDeleteResource(id, pin); setMsg(L(`${id} 삭제됨`, `${id} deleted`)); } catch (e) { setMsg(D((e as Error).message)); }
  };

  if (!pin) {
    return (
      <>
        <Header title={t("admin.title")} back="/" />
        <main className="p-4">
          <section className="card p-6">
            <p className="font-display text-lg text-ink">{L("관리자 PIN", "Admin PIN")}</p>
            <p className="mt-1 text-xs text-muted">{L("server/.env 의 ADMIN_PIN (기본 0000)", "ADMIN_PIN in server/.env (default 0000)")}</p>
            <input value={pinInput} onChange={(e) => setPinInput(e.target.value)} type="password" inputMode="numeric" className="mt-3 w-full rounded-xl border border-hairline px-3 py-3 font-mono text-lg" placeholder="••••" />
            <button onClick={login} className="pill mt-3 h-12 w-full bg-primary font-semibold text-white">{L("입장", "Enter")}</button>
            {msg && <p className="mt-2 text-xs text-down">{msg}</p>}
          </section>
        </main>
      </>
    );
  }

  const laundry = list.filter((r) => r.kind === "laundry");
  const levels = list.filter((r) => ["cafeteria", "shuttle", "space", "parking"].includes(r.kind));
  const Btn = ({ on, children, onClick }: { on?: boolean; children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick} className={`pill px-3 py-1.5 text-xs font-semibold ${on ? "bg-ink text-white" : "bg-surface-strong text-ink"}`}>{children}</button>
  );

  return (
    <>
      <Header title={t("admin.title")} back="/" />
      <main className="space-y-6 p-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{L("센서·카메라 대체 경로 · 수동 입력은 30분간 유효, 실측이 우선", "Fallback for sensors and cameras · manual input lasts 30 min; measurements win")}</span>
          <button onClick={() => { clearPin(); setPinState(""); }} className="text-primary">{L("로그아웃", "Log out")}</button>
        </div>
        {msg && <p className="text-sm text-primary">{msg}</p>}

        <section>
          <h2 className="mb-2 font-display text-base text-ink">{L("세탁기 상태", "Laundry machines")}</h2>
          <div className="space-y-2">
            {laundry.map((r) => (
              <div key={r.id} className="card flex items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 truncate">{D(r.zone)} {D(r.name)} <span className="text-xs text-muted-soft">({r.state})</span></span>
                <div className="flex gap-1">
                  {(["available", "in_use", "unknown"] as const).map((s) => (
                    <Btn key={s} on={r.state === s} onClick={() => send({ resource_id: r.id, state: s })}>{s === "available" ? L("비움", "Free") : s === "in_use" ? L("사용중", "In use") : L("불명", "Unknown")}</Btn>
                  ))}
                  <button onClick={() => remove(r.id)} className="pl-1 text-xs text-muted" aria-label={L("삭제", "Delete")}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base text-ink">{L("혼잡도 (학식·셔틀·오픈스페이스·주차)", "Crowding (cafeterias, shuttles, spaces, parking)")}</h2>
          <div className="space-y-2">
            {levels.map((r) => (
              <div key={r.id} className="card px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{D(r.name)}</span>
                  <div className="flex gap-1">
                    {(["relaxed", "normal", "crowded"] as const).map((l) => (
                      <Btn key={l} onClick={() => send({ resource_id: r.id, occupancy_level: l })}>{t(`level.${l}`)}</Btn>
                    ))}
                    <button onClick={() => remove(r.id)} className="pl-1 text-xs text-muted" aria-label={L("삭제", "Delete")}>✕</button>
                  </div>
                </div>
                {(r.kind === "space" || r.kind === "parking") && (
                  <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = Number((e.currentTarget.elements.namedItem("n") as HTMLInputElement).value); send({ resource_id: r.id, occupancy_count: v, occupancy_level: r.capacity ? (v / r.capacity < 0.5 ? "relaxed" : v / r.capacity < 0.85 ? "normal" : "crowded") : undefined }); }}>
                    <input name="n" type="number" min={0} placeholder={L(`현재 인원/차량 (정원 ${r.capacity ?? "?"})`, `Current people/cars (capacity ${r.capacity ?? "?"})`)} className="flex-1 rounded-xl border border-hairline px-3 py-1.5 text-sm" />
                    <button className="pill bg-ink px-4 py-1.5 text-xs font-semibold text-white">{L("입력", "Set")}</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base text-ink">{L("자원 등록", "Register a resource")}</h2>
          <div className="card grid grid-cols-2 gap-2 p-4 text-sm">
            <input placeholder={L("id (예: laundry-w5)", "id (e.g. laundry-w5)")} value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} className="rounded-xl border border-hairline px-3 py-2 font-mono" />
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="rounded-xl border border-hairline px-3 py-2">
              {["laundry", "cafeteria", "shuttle", "space", "parking"].map((k) => <option key={k}>{k}</option>)}
            </select>
            <input placeholder={L("구역 (예: 창의인재원 B동)", "Zone (e.g. Changui Residence B)")} value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} className="rounded-xl border border-hairline px-3 py-2" />
            <input placeholder={L("이름 (예: 세탁기 5)", "Name (e.g. Washer 5)")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-hairline px-3 py-2" />
            <input placeholder={L("정원 (선택)", "Capacity (optional)")} type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="rounded-xl border border-hairline px-3 py-2" />
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="rounded-xl border border-hairline px-3 py-2">
              {["sensor", "vision", "qr", "admin", "report"].map((k) => <option key={k}>{k}</option>)}
            </select>
            <button onClick={create} disabled={!form.id || !form.name || !form.zone} className="pill col-span-2 h-11 bg-primary font-semibold text-white disabled:bg-primary-disabled">{L("등록", "Register")}</button>
          </div>
        </section>

        <section className="card p-4 text-xs text-body">
          <p className="font-semibold text-ink">{L("도구", "Tools")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/sensor" className="pill bg-surface-strong px-3 py-1.5 font-semibold text-ink">{L("휴대폰을 진동 센서로", "Phone as vibration sensor")}</Link>
            <Link href="/camera" className="pill bg-surface-strong px-3 py-1.5 font-semibold text-ink">{L("휴대폰을 카메라로", "Phone as camera")}</Link>
            <button onClick={() => api.pushTest(deviceId).then(() => setMsg(L("테스트 푸시 전송 (구독이 있으면 도착)", "Test push sent (arrives if subscribed)")))} className="pill bg-surface-strong px-3 py-1.5 font-semibold text-ink">{L("푸시 테스트", "Test push")}</button>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-surface-soft p-3 text-[11px]">{`.venv/bin/python vision/run_video.py --loop --show
.venv/bin/python sensors/simulate_washer.py --resource laundry-changui-w1 --speed 20`}</pre>
        </section>
      </main>
    </>
  );
}
