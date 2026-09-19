"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { api, type Prefs } from "@/lib/api";
import { setAuth, useAuth, useAuthReady } from "@/lib/auth";
import { setLang, useD, useL, useLang, useT } from "@/lib/i18n";
import { useRealtime } from "@/lib/realtime";

/**
 * 내 정보: 닉네임, 기숙사 동, 자주 가는 식당, 기본 정류장, 알림 설정, 언어 + 내 대기열/체크인 현황.
 * 저장은 서버(users.prefs). 학번·실명 없음.
 */
/** 셀렉트 박스. 렌더 함수 밖에 두어야 입력 중 포커스가 안 튑니다. */
function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <label className="block text-sm"><span className="text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-hairline bg-canvas px-3 py-2.5">
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select></label>
  );
}

const DORMS = [{ v: "none", l: "기숙사 아님", en: "Not in a dorm" }, { v: "injae", l: "인재관", en: "Injae Hall" }, { v: "changui", l: "창의관", en: "Changui Hall" }, { v: "haengbok", l: "행복관", en: "Haengbok Hall" }];

export default function MePage() {
  const user = useAuth();
  const authReady = useAuthReady();
  const router = useRouter();
  const t = useT();
  const L = useL();
  const D = useD();
  const lang = useLang();   // 언어 칸은 서버에 저장된 값이 아니라 지금 화면 언어를 따라감 (저장 시 화면이 되돌아가지 않게)
  const { list, myTickets } = useRealtime();
  const [prefs, setPrefs] = useState<Prefs>({ dorm: "none", notify_queue: true, notify_shuttle: false, lang: "ko" });
  const [msg, setMsg] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const token = user?.token;
  useEffect(() => {
    if (!authReady) return;                   // 아직 localStorage 를 못 읽은 첫 렌더: 판단 보류
    if (!token) { router.replace("/login"); return; }
    // 토큰이 바뀔 때(로그인/로그아웃)만 서버 값을 불러옵니다. 폼 입력 중에는 다시 불러오지 않음.
    api.me(token).then((u) => { setPrefs({ dorm: "none", notify_queue: true, notify_shuttle: false, lang: "ko", ...u.prefs }); setReady(true); })
      .catch(() => { setAuth(null); router.replace("/login"); });
  }, [authReady, token, router]);

  if (!user) return null;
  const save = async () => {
    try { const u = await api.savePrefs(user.token, { ...prefs, lang }); setAuth({ ...user, prefs: u.prefs }); setMsg(L("저장됨", "Saved")); }
    catch (e) { setMsg(D((e as Error).message)); }
  };
  const logout = async () => { try { await api.logout(user.token); } finally { setAuth(null); router.replace("/"); } };
  const cafes = list.filter((r) => r.kind === "cafeteria"), stops = list.filter((r) => r.kind === "shuttle");
  return (
    <>
      <Header title={t("nav.me")} back="/" />
      <main className="space-y-4 p-4">
        <section className="card flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-display text-xl text-white">{user.nickname.slice(0, 1)}</span>
          <div className="flex-1"><p className="font-display text-lg text-ink">{user.nickname}</p><p className="text-xs text-muted">{L("익명 계정 · 학번/실명 없음", "Anonymous account · no student ID or name")}</p></div>
          <button onClick={logout} className="pill bg-surface-strong px-3 py-1.5 text-xs font-semibold text-ink">{t("logout")}</button>
        </section>

        {ready && (
          <section className="card space-y-3 p-5">
            <h2 className="font-display text-base text-ink">{L("내 설정", "My settings")}</h2>
            <Sel label={L("기숙사", "Dorm")} value={prefs.dorm ?? "none"} onChange={(v) => setPrefs({ ...prefs, dorm: v })} options={DORMS.map((d) => ({ v: d.v, l: L(d.l, d.en) }))} />
            <Sel label={L("자주 가는 식당", "Favorite cafeteria")} value={prefs.favorite_cafeteria ?? ""} onChange={(v) => setPrefs({ ...prefs, favorite_cafeteria: v || null })} options={[{ v: "", l: L("선택 안 함", "None") }, ...cafes.map((c) => ({ v: c.id, l: D(c.name) }))]} />
            <Sel label={L("기본 셔틀 정류장", "Default shuttle stop")} value={prefs.default_stop ?? ""} onChange={(v) => setPrefs({ ...prefs, default_stop: v || null })} options={[{ v: "", l: L("선택 안 함", "None") }, ...stops.map((c) => ({ v: c.id, l: D(c.name) }))]} />
            <Sel label={L("언어", "Language")} value={lang} onChange={(v) => { setLang(v as "ko" | "en"); setPrefs({ ...prefs, lang: v }); }} options={[{ v: "ko", l: "한국어" }, { v: "en", l: "English" }]} />
            <label className="flex items-center justify-between text-sm"><span>{L("세탁기 내 차례 알림", "Notify me when it is my turn (laundry)")}</span><input type="checkbox" checked={!!prefs.notify_queue} onChange={(e) => setPrefs({ ...prefs, notify_queue: e.target.checked })} className="h-5 w-5 accent-primary" /></label>
            <label className="flex items-center justify-between text-sm"><span>{L("기본 정류장 셔틀 출발 알림", "Notify me of departures at my default stop")}</span><input type="checkbox" checked={!!prefs.notify_shuttle} onChange={(e) => setPrefs({ ...prefs, notify_shuttle: e.target.checked })} className="h-5 w-5 accent-primary" /></label>
            <button onClick={save} className="pill h-11 w-full bg-primary font-semibold text-white">{L("저장", "Save")}</button>
            {msg && <p className="text-xs text-body">{msg}</p>}
          </section>
        )}

        <section className="card p-5">
          <h2 className="font-display text-base text-ink">{L("내 현황", "My status")}</h2>
          {myTickets.length === 0 ? <p className="mt-1 text-sm text-muted">{L("대기 중인 세탁기가 없습니다.", "You are not in any laundry queue.")}</p> : (
            <ul className="mt-1 divide-y divide-hairline-soft">
              {myTickets.map((tk) => <li key={tk.id} className="flex justify-between py-2 text-sm"><span>{D(tk.name)}</span><span className={tk.status === "called" ? "text-primary font-semibold" : "text-body"}>{tk.status === "called" ? L("내 차례!", "Your turn!") : L(`${tk.position}번 · 앞에 ${tk.people_ahead}명`, `#${tk.position} · ${tk.people_ahead} ahead`)}</span></li>)}
            </ul>
          )}
          {prefs.dorm && prefs.dorm !== "none" && <Link href={`/laundry/${prefs.dorm}`} className="mt-3 block text-sm text-primary">{L("내 기숙사 세탁실 바로가기 ›", "Go to my dorm laundry ›")}</Link>}
          {prefs.default_stop && <Link href={`/shuttle/${prefs.default_stop}`} className="mt-1 block text-sm text-primary">{L("기본 정류장 바로가기 ›", "Go to my default stop ›")}</Link>}
        </section>

        <section className="card p-5 text-sm">
          <Link href="/admin" className="text-primary">{L("관리자 화면 ›", "Admin screen ›")}</Link>
        </section>
      </main>
    </>
  );
}
